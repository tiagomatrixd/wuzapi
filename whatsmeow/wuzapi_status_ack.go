package whatsmeow

// WUZAPI LOCAL PATCH — see WUZAPI_PATCHES.md in this directory.
//
// This file is not part of upstream whatsmeow. It adds a handler for <status>
// stanzas (channel/status updates that upstream doesn't support yet, e.g.
// status updates from followed newsletters). Upstream drops these nodes in
// handleFrame without ever acking them, so the WhatsApp server redelivers
// them on every connect — and when they sit at the head of a large offline
// queue, the server has been observed to stop flushing the rest of the queue,
// wedging message delivery for the whole session ("connected, sends fine,
// never receives"). Acking them lets the server clear them and move on; the
// content is intentionally discarded.

import (
	"context"

	waBinary "go.mau.fi/whatsmeow/binary"
)

func (cli *Client) handleUnsupportedStatusNode(ctx context.Context, node *waBinary.Node) {
	cli.Log.Debugf("Acking and discarding unsupported status node %v from %v", node.Attrs["id"], node.Attrs["from"])
	cli.sendAck(ctx, node, 0)
}
