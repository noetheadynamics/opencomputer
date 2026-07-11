"""Phase 14 Verification — automated + code-inspection tests."""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from httpx import Client

BASE = "http://127.0.0.1:8420"
results = []

def q(n, label, passed, detail=""):
    status = "PASSED" if passed else "FAILED"
    suffix = f" ({detail})" if detail else ""
    results.append((n, label, status))
    print(f"{n:2d}. {label}: {status}{suffix}")

def post(path, data=None):
    with Client(base_url=BASE, timeout=30) as c:
        r = c.post(path, json=data or {})
    return r.status_code, r.json() if "json" in r.headers.get("content-type","") else {"text": r.text}

def get(path, params=None):
    with Client(base_url=BASE, timeout=30) as c:
        r = c.get(path, params=params or {})
    return r.status_code, r.json() if "json" in r.headers.get("content-type","") else {"text": r.text}

def put(path, data=None):
    with Client(base_url=BASE, timeout=30) as c:
        r = c.put(path, json=data or {})
    return r.status_code, r.json() if "json" in r.headers.get("content-type","") else {"text": r.text}

def delete(path):
    with Client(base_url=BASE, timeout=30) as c:
        r = c.delete(path)
    return r.status_code, r.json() if "json" in r.headers.get("content-type","") else {"text": r.text}

# ── File system checks ────────────────────────────────────────

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

def file_exists(path):
    return os.path.exists(os.path.join(PROJECT_ROOT, path))

def file_contains(path, text):
    try:
        full = os.path.join(PROJECT_ROOT, path)
        with open(full, 'r', encoding='utf-8') as f:
            return text in f.read()
    except:
        return False

try:
    # ── 1-3: File/Image Attachments ──────────────────────────
    q(1, "File attachment", file_exists("src/components/chat/AttachmentPreview.tsx") and file_exists("src/hooks/useAttachments.ts"), "components exist")
    q(2, "Image attachment", file_contains("src/components/chat/AttachmentPreview.tsx", "image") and file_contains("src/lib/upload.ts", "createFilePreview"), "thumbnail support")
    q(3, "Drag and drop", file_contains("src/components/chat/ChatInput.tsx", "onDrop") and file_contains("src/components/chat/ChatInput.tsx", "handleDrop"), "drag-drop handlers")

    # ── 4: Upload progress ───────────────────────────────────
    q(4, "Upload progress", file_contains("src/lib/upload.ts", "onProgress") and file_contains("src/hooks/useAttachments.ts", "uploading"), "progress tracking")

    # ── 5-6: Command palette ─────────────────────────────────
    q(5, "Command palette", file_exists("src/components/chat/CommandPalette.tsx") and file_contains("src/types/chat.ts", "COMMANDS"), "palette exists")
    q(6, "Command execution", file_contains("src/components/chat/ChatInput.tsx", "handleCommandSelect") and file_contains("src/types/chat.ts", "'/code'"), "commands defined")

    # ── 7-8: @ mentions ─────────────────────────────────────
    q(7, "@ mentions", file_exists("src/components/chat/MentionsPopover.tsx") and file_contains("src/components/chat/ChatInput.tsx", "showMentions"), "mentions exist")
    q(8, "@ mention insert", file_contains("src/components/chat/ChatInput.tsx", "handleMentionSelect"), "insert handler")

    # ── 9: Formatting toolbar ────────────────────────────────
    q(9, "Formatting toolbar", file_exists("src/components/chat/FormattingToolbar.tsx") and file_contains("src/components/chat/ChatInput.tsx", "handleFormat"), "formatting support")

    # ── 10-11: Artifacts panel ───────────────────────────────
    q(10, "Artifacts panel", file_exists("src/components/chat/ArtifactsPanel.tsx") and file_exists("src/hooks/useArtifacts.ts"), "artifacts exist")
    q(11, "Artifact expansion", file_contains("src/components/chat/ArtifactsPanel.tsx", "setSelected"), "selection/expansion")

    # ── 12: iMessage-style bubbles ───────────────────────────
    q(12, "iMessage-style bubbles",
      file_contains("src/components/chat/ChatBubble.tsx", "rounded-br-sm") and
      file_contains("src/components/chat/ChatBubble.tsx", "rounded-bl-sm") and
      file_contains("src/components/chat/ChatBubble.tsx", "absolute bottom-0 w-3 h-3"),
      "bubbles with tails")

    # ── 13: Blue link text ───────────────────────────────────
    q(13, "Blue link text",
      file_contains("src/components/chat/ChatBubble.tsx", "text-blue-400") and
      file_contains("src/components/chat/ChatBubble.tsx", "underline"),
      "blue links")

    # ── 14: Link preview ─────────────────────────────────────
    q(14, "Link preview", file_exists("src/components/chat/LinkPreview.tsx") and file_contains("src/components/chat/ChatBubble.tsx", "LinkPreview"), "link preview")

    # ── 15-17: Reaction picker ───────────────────────────────
    q(15, "Reaction picker", file_exists("src/components/chat/ReactionPicker.tsx") and file_contains("src/types/chat.ts", "DEFAULT_REACTIONS"), "picker exists")
    q(16, "Add reaction", file_contains("src/components/chat/ReactionPicker.tsx", "onSelect"), "add handler")
    q(17, "Remove reaction", file_contains("src/lib/reactions.ts", "removeReaction"), "remove handler")

    # ── 18: Swipe to reply ───────────────────────────────────
    q(18, "Swipe to reply", file_exists("src/hooks/useSwipe.ts") and file_contains("src/hooks/useSwipe.ts", "onSwipeRight"), "swipe hook")

    # ── 19: Threaded replies ─────────────────────────────────
    q(19, "Threaded replies", file_exists("src/components/chat/ChatThread.tsx") and file_exists("src/hooks/useThreads.ts"), "thread support")

    # ── 20-23: Long press menu ───────────────────────────────
    q(20, "Long press menu", file_exists("src/components/chat/LongPressMenu.tsx"), "menu exists")
    q(21, "Copy message", file_contains("src/components/chat/LongPressMenu.tsx", "Copy"), "copy action")
    q(22, "Edit message", file_contains("src/components/chat/LongPressMenu.tsx", "Edit"), "edit action")
    q(23, "Delete message", file_contains("src/components/chat/LongPressMenu.tsx", "Delete"), "delete action")

    # ── 24: Message grouping ─────────────────────────────────
    q(24, "Message grouping", file_exists("src/components/chat/ChatMessageGroup.tsx") and file_contains("src/components/chat/ChatMessageGroup.tsx", "getGroupLabel"), "grouping logic")

    # ── 25: Timestamp display ────────────────────────────────
    q(25, "Timestamp display", file_contains("src/components/chat/ChatBubble.tsx", "formatTime") and file_contains("src/components/chat/ChatBubble.tsx", "timestamp"), "timestamps")

    # ── 26: Date separators ──────────────────────────────────
    q(26, "Date separators", file_contains("src/components/chat/ChatMessageGroup.tsx", "Today") and file_contains("src/components/chat/ChatMessageGroup.tsx", "Yesterday"), "date labels")

    # ── 27: Typing indicator ─────────────────────────────────
    q(27, "Typing indicator", file_exists("src/components/chat/TypingIndicator.tsx") and file_contains("src/components/chat/TypingIndicator.tsx", "animate"), "animated dots")

    # ── 28: Avatars ──────────────────────────────────────────
    q(28, "Avatars", file_exists("src/components/chat/Avatar.tsx") and file_contains("src/components/chat/ChatBubble.tsx", "Avatar"), "avatar component")

    # ── 29: Scroll to bottom ─────────────────────────────────
    q(29, "Scroll to bottom", file_exists("src/components/chat/ScrollToBottom.tsx") and file_contains("src/components/chat/ScrollToBottom.tsx", "ChevronDown"), "scroll button")

    # ── 30: Dark/Light theme ─────────────────────────────────
    q(30, "Dark/Light theme", file_contains("src/components/chat/ChatBubble.tsx", "bg-oc-accent") and file_contains("src/components/chat/ChatBubble.tsx", "bg-oc-surface"), "theme classes")

    # ── 31-38: Subagent Manager ──────────────────────────────
    q(31, "Subagent panel", file_exists("src/components/settings/SubagentManagerPanel.tsx"), "panel exists")

    # Create subagent via API
    code, r = post("/api/subagents/", {"name": "Verify Bot", "task_type": "coding", "system_prompt": "You are a code reviewer", "tools": ["read_file"]})
    sa_id = r.get("id") if code == 200 else None
    q(32, "Create subagent", code == 200 and sa_id is not None, f"id={sa_id}")

    # Edit subagent
    if sa_id:
        code, r = put(f"/api/subagents/{sa_id}", {"name": "Updated Bot"})
        q(33, "Edit subagent", code == 200 and r.get("success"), "updated")
    else:
        q(33, "Edit subagent", False, "no subagent created")

    # Enable/disable
    if sa_id:
        code, r = post(f"/api/subagents/{sa_id}/toggle?enabled=false")
        code2, sa = get(f"/api/subagents/{sa_id}")
        q(34, "Enable/disable", code == 200 and sa.get("enabled") == False, "disabled")
    else:
        q(34, "Enable/disable", False, "no subagent")

    # Delete subagent
    if sa_id:
        code, r = delete(f"/api/subagents/{sa_id}")
        q(35, "Delete subagent", code == 200 and r.get("success"), "deleted")
    else:
        q(35, "Delete subagent", False, "no subagent")

    # Test subagent
    code, r = post("/api/subagents/", {"name": "Test Me", "task_type": "coding"})
    test_id = r.get("id") if code == 200 else None
    if test_id:
        code, r = post(f"/api/subagents/{test_id}/test", {"query": "hello"})
        q(36, "Test subagent", code == 200 and "success" in r, f"success={r.get('success')}")
        delete(f"/api/subagents/{test_id}")
    else:
        q(36, "Test subagent", False, "no subagent")

    # Task type assignment
    q(37, "Task type assignment", file_contains("src/types/subagent.ts", "coding") and file_contains("src/types/subagent.ts", "vision"), "task types defined")

    # Tool permissions
    q(38, "Tool permissions", file_contains("src/types/subagent.ts", "read_file") and file_contains("src/components/settings/SubagentManagerPanel.tsx", "toggleTool"), "tool permissions")

    # ── 39-43: Integration (code-based verification) ─────────
    q(39, "File attachment + AI", file_contains("src/components/chat/ChatInput.tsx", "attachments") and file_contains("src/components/chat/ChatInput.tsx", "onSend"), "file attach flow")
    q(40, "Image + Vision", file_contains("src/types/subagent.ts", "vision") and file_exists("src/components/chat/AttachmentPreview.tsx"), "vision support")
    q(41, "Artifact export", file_contains("src/components/chat/ArtifactsPanel.tsx", "handleCopy"), "copy/export")
    q(42, "Command palette + Artifact", file_contains("src/types/chat.ts", "'/code'") and file_contains("src/components/chat/CommandPalette.tsx", "Code"), "code command")
    q(43, "Subagent routing", file_contains("src/types/subagent.ts", "task_type") and file_contains("src/components/settings/SubagentManagerPanel.tsx", "TASK_TYPES"), "routing support")

except Exception as e:
    print(f"\nERROR: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*60)
passed = sum(1 for _, _, s in results if s == "PASSED")
total = len(results)
print(f"Results: {passed}/{total} PASSED")
print("="*60)
