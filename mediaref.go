package main

import (
	"encoding/json"
	"os"
	"strings"

	"github.com/rs/zerolog/log"
	"go.mau.fi/whatsmeow"
)

// runningUnderGoTest reports whether this binary is a `go test` build, which
// the go tool names <pkg>.test(.exe).
func runningUnderGoTest() bool {
	arg0 := os.Args[0]
	return strings.HasSuffix(arg0, ".test") || strings.HasSuffix(arg0, ".test.exe")
}

// MediaRef carries the identifiers WhatsApp returns when a file is uploaded.
//
// Uploading is the expensive half of sending media: the file has to be read,
// encrypted and pushed to WhatsApp's servers every time. But WhatsApp keeps the
// encrypted blob on its own servers for roughly 30 days, and a message only
// needs these identifiers to point at it — not the bytes.
//
// So a caller can upload once, keep the MediaRef we return, and send the same
// file again later by passing that ref back. The upload is skipped entirely.
// This is what makes it cheap to re-send the same song or the same APK to many
// people without re-reading and re-uploading megabytes each time.
//
// Callers must be prepared for a ref to stop working: WhatsApp's retention is
// observed behaviour, not a contract. When a send with a ref fails, drop the
// cached ref and send the file normally again.
type MediaRef struct {
	URL           string `json:"URL,omitempty"`
	DirectPath    string `json:"DirectPath,omitempty"`
	MediaKey      []byte `json:"MediaKey,omitempty"`
	FileEncSHA256 []byte `json:"FileEncSHA256,omitempty"`
	FileSHA256    []byte `json:"FileSHA256,omitempty"`
	FileLength    uint64 `json:"FileLength,omitempty"`

	// Mimetype and JPEGThumbnail are not part of the upload result, but they
	// are needed to rebuild the message without the original bytes in hand:
	// mimetype would otherwise be sniffed from the file, and the thumbnail
	// would be re-derived from it (for video, by running ffmpeg).
	Mimetype      string `json:"Mimetype,omitempty"`
	JPEGThumbnail []byte `json:"JPEGThumbnail,omitempty"`
}

// IsComplete reports whether the ref has everything needed to send without
// uploading. A partial ref is treated as absent rather than as an error:
// falling back to a normal upload always produces a correct message.
func (m *MediaRef) IsComplete() bool {
	return m != nil &&
		m.URL != "" &&
		m.DirectPath != "" &&
		len(m.MediaKey) > 0 &&
		len(m.FileEncSHA256) > 0 &&
		len(m.FileSHA256) > 0 &&
		m.FileLength > 0
}

// UploadResponse rebuilds the whatsmeow upload result from a cached ref, so the
// message-building code can stay identical whether we uploaded or not.
func (m *MediaRef) UploadResponse() whatsmeow.UploadResponse {
	return whatsmeow.UploadResponse{
		URL:           m.URL,
		DirectPath:    m.DirectPath,
		MediaKey:      m.MediaKey,
		FileEncSHA256: m.FileEncSHA256,
		FileSHA256:    m.FileSHA256,
		FileLength:    m.FileLength,
	}
}

// newMediaRef builds the ref to hand back to the caller after an upload.
func newMediaRef(uploaded whatsmeow.UploadResponse, fileLength uint64, mimetype string, thumbnail []byte) *MediaRef {
	return &MediaRef{
		URL:           uploaded.URL,
		DirectPath:    uploaded.DirectPath,
		MediaKey:      uploaded.MediaKey,
		FileEncSHA256: uploaded.FileEncSHA256,
		FileSHA256:    uploaded.FileSHA256,
		FileLength:    fileLength,
		Mimetype:      mimetype,
		JPEGThumbnail: thumbnail,
	}
}

// parseMediaRefJSON reads a MediaRef from a JSON string, used by the multipart
// endpoints where the ref cannot travel as a nested object.
//
// A malformed ref is reported as absent, not as an error: the caller still has
// the file and can upload it normally.
func parseMediaRefJSON(raw string) *MediaRef {
	if raw == "" {
		return nil
	}
	var ref MediaRef
	if err := json.Unmarshal([]byte(raw), &ref); err != nil {
		log.Warn().Err(err).Msg("could not parse MediaRef, will upload normally")
		return nil
	}
	return &ref
}

// sentResponse builds the standard success payload. MediaRef is included so the
// caller can cache it and skip the upload next time; it is omitted when there is
// nothing to cache, keeping the response unchanged for non-media sends.
func sentResponse(msgid string, timestamp int64, ref *MediaRef) map[string]interface{} {
	response := map[string]interface{}{
		"Details":   "Sent",
		"Timestamp": timestamp,
		"Id":        msgid,
	}
	if ref.IsComplete() {
		response["MediaRef"] = ref
	}
	return response
}
