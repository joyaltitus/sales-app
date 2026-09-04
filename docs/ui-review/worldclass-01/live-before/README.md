# Live-before run

Captured 2026-09-04 from the real demo tenant at 1280×900 and 390×844, in light and dark themes.

## Completed

- Rep: 80 route/state screenshots across Today, Inbox, every CRM tab, More and My Season, Agent, Documents, and Playbook.
- Rep mid-flow: thread draft (not sent), notification rail, command palette, Add Lead, lead drawer, unsaved stage change, call outcome, and follow-up choice.
- Document-level horizontal-overflow assertions: 0 failures.
- Credentials: entered through masked stdin and retained in memory only.

The stage-change screenshot is deliberately unsaved. The call-outcome and follow-up-choice screenshots use the public Preview Gallery's mock call inside the authenticated browser context, avoiding a permanent call record on an existing demo contact.

## Runtime failures

- Realtime WebSocket handshake: HTTP 502 on each fresh inbox context and during the mid-flow run. The UI falls back to polling, but live updates are unavailable.
- External Instagram avatar: HTTP 403, `URL signature expired`, on the Contacts route. The UI falls back to the contact avatar.
- Sixteen `net::ERR_ABORTED` HEAD requests occurred only when route navigation cancelled in-flight `messages` and `follow_ups` probes; these are navigation cancellations, not backend failures.

## Blocked roles

- Manager: the supplied credentials were rejected by the authentication service before a role route loaded.
- Client admin: credentials were not supplied.

No manager/client-admin screenshot is represented as live evidence until those accounts authenticate successfully.
