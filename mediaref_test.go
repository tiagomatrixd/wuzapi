package main

import (
	"encoding/json"
	"testing"

	"go.mau.fi/whatsmeow"
)

func completeRef() *MediaRef {
	return &MediaRef{
		URL:           "https://mmg.whatsapp.net/x",
		DirectPath:    "/v/t62.7118-24/abc",
		MediaKey:      []byte{1, 2, 3},
		FileEncSHA256: []byte{4, 5, 6},
		FileSHA256:    []byte{7, 8, 9},
		FileLength:    12345,
		Mimetype:      "audio/mpeg",
	}
}

func TestIsCompleteAcceptsFullRef(t *testing.T) {
	if !completeRef().IsComplete() {
		t.Fatal("a fully populated ref should be complete")
	}
}

func TestIsCompleteRejectsNil(t *testing.T) {
	// A nil ref must be safe to call: handlers check t.MediaRef.IsComplete()
	// before knowing whether the caller sent one at all.
	var ref *MediaRef
	if ref.IsComplete() {
		t.Fatal("nil ref must not be complete")
	}
}

func TestIsCompleteRejectsPartialRefs(t *testing.T) {
	// Each field is required: a ref missing any of them cannot build a valid
	// message, and we must fall back to uploading instead of sending garbage.
	cases := map[string]func(*MediaRef){
		"no URL":           func(m *MediaRef) { m.URL = "" },
		"no DirectPath":    func(m *MediaRef) { m.DirectPath = "" },
		"no MediaKey":      func(m *MediaRef) { m.MediaKey = nil },
		"no FileEncSHA256": func(m *MediaRef) { m.FileEncSHA256 = nil },
		"no FileSHA256":    func(m *MediaRef) { m.FileSHA256 = nil },
		"no FileLength":    func(m *MediaRef) { m.FileLength = 0 },
	}
	for name, breakIt := range cases {
		ref := completeRef()
		breakIt(ref)
		if ref.IsComplete() {
			t.Errorf("%s: ref should be incomplete", name)
		}
	}
}

func TestUploadResponseRoundTrip(t *testing.T) {
	// What we hand back to the caller must rebuild into the same upload result,
	// otherwise a cached send would produce a message pointing at nothing.
	uploaded := whatsmeow.UploadResponse{
		URL:           "https://mmg.whatsapp.net/y",
		DirectPath:    "/v/t62.7118-24/def",
		MediaKey:      []byte{10, 20},
		FileEncSHA256: []byte{30, 40},
		FileSHA256:    []byte{50, 60},
	}
	ref := newMediaRef(uploaded, 999, "video/mp4", []byte{1})
	got := ref.UploadResponse()

	if got.URL != uploaded.URL || got.DirectPath != uploaded.DirectPath {
		t.Fatalf("url/directPath lost: %+v", got)
	}
	if string(got.MediaKey) != string(uploaded.MediaKey) ||
		string(got.FileEncSHA256) != string(uploaded.FileEncSHA256) ||
		string(got.FileSHA256) != string(uploaded.FileSHA256) {
		t.Fatalf("keys lost: %+v", got)
	}
	if got.FileLength != 999 {
		t.Fatalf("file length lost: %d", got.FileLength)
	}
}

func TestMediaRefSurvivesJSONRoundTrip(t *testing.T) {
	// The ref travels to the caller as JSON and comes back the same way, so
	// []byte fields must survive base64 encoding intact.
	ref := completeRef()
	ref.JPEGThumbnail = []byte{0xFF, 0xD8, 0xFF}

	raw, err := json.Marshal(ref)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var back MediaRef
	if err := json.Unmarshal(raw, &back); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !back.IsComplete() {
		t.Fatal("ref stopped being complete after a JSON round trip")
	}
	if string(back.MediaKey) != string(ref.MediaKey) ||
		string(back.JPEGThumbnail) != string(ref.JPEGThumbnail) {
		t.Fatalf("binary fields corrupted: %+v", back)
	}
}

func TestParseMediaRefJSON(t *testing.T) {
	raw, _ := json.Marshal(completeRef())
	if got := parseMediaRefJSON(string(raw)); !got.IsComplete() {
		t.Fatal("valid JSON should parse into a complete ref")
	}
	// Absent and malformed refs both mean "upload normally", never an error.
	if got := parseMediaRefJSON(""); got != nil {
		t.Fatal("empty string should yield no ref")
	}
	if got := parseMediaRefJSON("{not json"); got != nil {
		t.Fatal("malformed JSON should yield no ref, not a partial one")
	}
}

func TestSentResponseIncludesRefOnlyWhenUsable(t *testing.T) {
	withRef := sentResponse("MSGID", 1700000000, completeRef())
	if _, ok := withRef["MediaRef"]; !ok {
		t.Fatal("a complete ref must be returned so the caller can cache it")
	}
	if withRef["Id"] != "MSGID" || withRef["Details"] != "Sent" {
		t.Fatalf("existing response fields changed: %+v", withRef)
	}

	// Text messages and partial refs must keep the old response shape, so
	// existing clients see no difference.
	noRef := sentResponse("MSGID", 1700000000, nil)
	if _, ok := noRef["MediaRef"]; ok {
		t.Fatal("nil ref must not add a MediaRef field")
	}
	partial := completeRef()
	partial.MediaKey = nil
	if _, ok := sentResponse("MSGID", 1, partial)["MediaRef"]; ok {
		t.Fatal("incomplete ref must not be returned as if it were usable")
	}
}
