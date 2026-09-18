# Backlog

[Issue #3: automatic GitHub receipt collection and claim relay](https://github.com/RonTuretzky/issue.fund/issues/3)

Track repositories internally from issue URLs, prepare notifications before funding, collect original GitHub emails, and relay valid claims. Includes shared readiness states, manual fallback, operating limits, and the reply-credential security dependency below. Implementation is in progress on `codex/automation-production`; the local collector, registry, encrypted storage, indexer and restricted relay have integration tests. Production onboarding/deployment and genuine-email acceptance remain open. See [operator setup](docs/operators/automation.md) and [security review](docs/operators/security-review.md).

[Issue #2: mitigate exposed GitHub reply credentials](https://github.com/RonTuretzky/issue.fund/issues/2)

Validate the disclosure policy before automatic collection publishes receipt data. A dedicated service mailbox shifts exposure to the collector account; it does not remove reply-token risks.

[Issue #1: restore optional private ZK email claims](https://github.com/RonTuretzky/issue.fund/issues/1)

The complete ZK implementation is preserved on [`codex/archive-zk-proving`](https://github.com/RonTuretzky/issue.fund/tree/codex/archive-zk-proving). The issue documents the circuit, proving artifacts, legacy deployment, trust model, operational requirements, missing work and acceptance criteria. The active app uses direct on-chain RSA/DKIM verification.
