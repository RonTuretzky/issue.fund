// Canonical documentation content. Used by the site and exported as Markdown.
export const maintainerAutomation = {
  title: "Premium automation for maintainers",
  paragraphs: [
    "Let contributors focus on the code. We can set up a premium service to collect and submit the required GitHub emails for your project, so contributors don’t have to upload them. Get in touch to discuss setup.",
  ],
  links: [
    {
      label: "Contact turetzkyron@gmail.com",
      url: "mailto:turetzkyron@gmail.com?subject=issue.fund%20premium%20automation",
    },
  ],
};

export const groups = [
  {
    id: "start",
    title: "Start here",
    description: "Understand the payment flow.",
  },
  {
    id: "maintainers",
    title: "Maintainers & funders",
    description: "Choose an issue, fund the work, and review a contribution.",
  },
  {
    id: "contributors",
    title: "Contributors & users",
    description: "Prepare your PR, collect receipts, and claim your reward.",
  },
  {
    id: "reference",
    title: "Reference",
    description: "Verification, privacy, troubleshooting, and developer setup.",
  },
];
export const pages = [
  {
    id: "overview",
    group: "start",
    title: "How bounties work",
    summary:
      "From an open GitHub issue to a wallet payment, with no payout operator.",
    sections: [
      {
        title: "One issue. A funded reward. Two signed receipts.",
        paragraphs: [
          "A bounty holds a reward for a public GitHub issue in a smart contract. A maintainer reviews the contribution and merges the pull request. The contributor uses GitHub’s original merge and linked issue-closure emails to claim the reward.",
          "The contract checks GitHub’s RSA/DKIM email signatures directly. There is no proof-generation step, proving service, GitHub login in this app, or approval from a payout operator. GitHub still supplies the evidence about what was merged.",
        ],
      },
      {
        title: "The complete flow",
        steps: [
          "Fund: choose an open issue in a public repository and deposit a reward in xDAI on Gnosis.",
          "Prepare: the contributor adds the bounty reference and payout wallet to the PR title, links the issue, and arranges email notifications.",
          "Merge: the maintainer reviews the code and merges into the funded target branch before the deadline.",
          "Claim: upload the two original event emails, check the payout wallet, acknowledge their public disclosure, and submit the claim.",
          "Withdraw: the wallet in the authenticated PR title withdraws its credited reward.",
        ],
      },
      {
        title: "Choose your path",
        paragraphs: [
          "Maintainers decide whether a contribution solves the issue. Funders supply the reward; a funder does not have to own the repository. Start with [Maintainer onboarding](#docs/maintainers/getting-started).",
          "Contributors do the work and designate a payout wallet. Anyone holding a valid pair of receipts may submit the claim, but cannot change who gets paid. Start with [Contributor onboarding](#docs/contributors/getting-started).",
        ],
      },
      {
        title: "What you need",
        bullets: [
          "A public GitHub repository with issues enabled, and an open issue.",
          "A Gnosis-compatible browser wallet. Rewards and transaction fees use native xDAI; sending ETH on another network does not fund this escrow.",
          "A way to receive and download the original GitHub email notifications. Set this up before the merge.",
          "Agreement to publish the signed email data when claiming. Read [Email privacy](#docs/reference/privacy) before choosing which mailbox will receive it.",
        ],
      },
      {
        title: "When the clock runs out",
        paragraphs: [
          "Both emails must be signed during the funded completion window. A further seven days allows submission of a claim for work completed in that window. After that, the original funder can reclaim an unclaimed reward. See [Manage rewards and refunds](#docs/maintainers/manage-bounties).",
        ],
      },
    ],
  },
  {
    id: "maintainers/getting-started",
    group: "maintainers",
    title: "Maintainer onboarding",
    summary:
      "Set up a public repository and a clear agreement with contributors.",
    sections: [
      {
        title: "Your role",
        paragraphs: [
          "You review code and decide what to merge using your normal GitHub process. Manual receipt claims need no signing-key registration, GitHub App, or separate maintainer payout approval. Automatic collection, where offered, uses a maintainer-installed collector App. The merged PR and linked issue event remain the payment evidence.",
          "A funder may be a maintainer, contributor, or sponsor. Start with an issue URL; no repository registration or GitHub connection is required.",
        ],
      },
      maintainerAutomation,
      {
        title: "Before funding",
        bullets: [
          "Write clear acceptance criteria in an open GitHub issue: expected behavior, scope, and how you will review the fix.",
          "Keep the repository public, with issues enabled, and use its default branch as the merge target. Archived or disabled repositories are not accepted by onboarding.",
          "Agree with the contributor on a completion deadline, payout wallet, and who will receive both original event emails.",
          "Read [Email privacy](#docs/reference/privacy), then enable the required notifications before anyone merges.",
        ],
      },
      {
        title: "Start with an issue",
        steps: [
          "Choose an open issue on GitHub, or create one there using the repository’s issue templates.",
          "Open Fund an issue and paste the issue URL. The app checks the public repository, issue, and default branch automatically.",
          "Review the reward and deadline, then confirm funding in your wallet.",
          "The repository appears in Repositories once it has a bounty. This optional directory lets anyone browse and search its issues; there are no browser bookmarks to manage.",
        ],
        links: [{ label: "Explore bounties", url: "#" }],
      },
      {
        title: "Publish the contribution instructions",
        paragraphs: [
          "Share the bounty’s URL with contributors. Ask them to copy its PR-title markers exactly and link the funded issue in the PR description. Let them know that claiming publishes the signed email data and requires a separate withdrawal transaction.",
          "Continue with [Fund an issue](#docs/maintainers/fund-issue), then use [Review and merge](#docs/maintainers/review-and-merge) before completing a contribution.",
        ],
      },
    ],
  },
  {
    id: "maintainers/fund-issue",
    group: "maintainers",
    title: "Fund an issue",
    summary:
      "Check the target, choose the reward and deadline, and create the escrow.",
    sections: [
      {
        title: "Connect the funding wallet",
        paragraphs: [
          "Use Connect wallet and select Browser wallet. If prompted, switch to Gnosis (chain ID 100). Keep enough native xDAI for the reward and gas. Connecting does not itself move funds; funding requires a transaction confirmation.",
        ],
      },
      {
        title: "Review and fund",
        steps: [
          "Open Fund an issue or select an issue from Repositories. Paste an issue URL such as https://github.com/owner/repo/issues/42.",
          "Choose Review issue. Check the canonical repository name, issue title and number, and target branch. A pull-request URL or closed issue cannot be funded through this flow.",
          "Enter the reward in xDAI and choose 7, 14, 30, or 90 days to complete the work.",
          "Read the escrow terms and acknowledge that you will arrange the required email notifications.",
          "Choose Fund bounty. The app checks GitHub again before asking your wallet to confirm. Wait for the transaction to succeed, then share the new bounty page.",
        ],
      },
      maintainerAutomation,
      {
        title: "Terms fixed by the transaction",
        table: {
          headers: ["Term", "What it means"],
          rows: [
            [
              "Repository and issue",
              "Only receipts for the funded repository name and issue can settle this bounty.",
            ],
            [
              "Target branch",
              "The checked default branch is fixed at funding. Coordinate before changing it on GitHub.",
            ],
            [
              "Reward and deadline",
              "They cannot be edited or withdrawn early after funding.",
            ],
            [
              "Claim grace period",
              "Seven days after the completion deadline, for submitting receipts signed within the completion window.",
            ],
            [
              "Platform fee",
              "The funding form shows the immutable claim fee and the contributor’s net reward. The original V1 escrow has no fee; fee-bearing V2 escrows deduct only on successful claims. Refunds return the full reward. Wallet transactions still use gas.",
            ],
          ],
        },
      },
      {
        title: "Existing bounties and additional funding",
        paragraphs: [
          "Creating another bounty does not top up an existing reward. Each bounty has a different reference, and the supported PR title has exactly one reference. One merged-PR receipt cannot settle several separate bounties. Review any duplicate warning before committing more funds.",
        ],
      },
      {
        title: "If funding is interrupted",
        paragraphs: [
          "If you reject the wallet request, the form remains available to retry. If you submitted a transaction, check its wallet or explorer status before funding again. An issue closed, renamed, replaced, or moved to another default branch during review requires a fresh preflight.",
          "Once funded, continue to [Review and merge](#docs/maintainers/review-and-merge). For expiry, see [Manage rewards and refunds](#docs/maintainers/manage-bounties).",
        ],
      },
    ],
  },
  {
    id: "maintainers/review-and-merge",
    group: "maintainers",
    title: "Review and merge",
    summary:
      "Make sure the accepted PR produces receipts that can settle the bounty.",
    sections: [
      {
        title: "Review the contribution normally",
        paragraphs: [
          "Run your project’s tests and verify the issue’s acceptance criteria. The escrow checks signed GitHub events; it does not inspect code quality, test results, authorship, or whether the fix is useful. Your merge decision still matters.",
        ],
      },
      {
        title: "Before pressing Merge",
        bullets: [
          "The bounty is still open and there is time for GitHub to issue both notifications before the completion deadline.",
          "The PR targets the exact branch on the bounty page, and that branch is still the repository’s default branch.",
          "The PR title contains exactly one complete bounty reference and one nonzero payout-wallet marker, copied from this bounty.",
          "The contributor has confirmed the full wallet address, including when a maintainer has permission to edit the title.",
          "The description links the same funded issue using Closes #ISSUE_NUMBER. Keep the issue open until the merge closes it.",
          "A participant is subscribed to both the issue and PR, with email delivery enabled. If that person performs the merge, check their own-activity notification settings too.",
        ],
      },
      {
        title: "Link the issue in the description",
        paragraphs: [
          "For an issue in the same repository, use the following pattern, replacing 42 with its actual issue number. The funded repository and merge receipt must match; do not substitute a cross-repository workflow.",
        ],
        code: "Closes #42",
        links: [
          {
            label: "GitHub: linking a pull request to an issue",
            url: "https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue",
          },
        ],
      },
      {
        title: "After the merge",
        steps: [
          "Confirm that GitHub reports the PR merged into the target branch.",
          "Confirm that the funded issue was closed as completed through that PR.",
          "Have the receipt holder download the specific native merge and linked closure messages, not a comment or the whole conversation.",
          "The contributor can now follow Claim and withdraw. No additional signature or release action is needed from you.",
        ],
      },
      {
        title: "Avoid an unclaimable merge",
        paragraphs: [
          "Putting the wallet only in a branch name, comment, commit message, or PR description does not meet this payment rule. Manually closing the issue does not replace the linked closure event. Editing the PR title after merging cannot change the title authenticated by the original merge email.",
          "Continue with [Collect the email receipts](#docs/contributors/collect-emails) or [Troubleshooting](#docs/reference/troubleshooting) if either event is missing.",
        ],
      },
    ],
  },
  {
    id: "maintainers/manage-bounties",
    group: "maintainers",
    title: "Manage rewards and refunds",
    summary:
      "Understand bounty states, expiry, and the funder’s withdrawal path.",
    sections: [
      {
        title: "Read the bounty state",
        table: {
          headers: ["State", "What you can do"],
          rows: [
            [
              "Open",
              "Complete and merge the work; receipts must be signed by the completion deadline.",
            ],
            [
              "Claim period",
              "Submit an eligible pair already signed within the completion window. This does not extend the work deadline.",
            ],
            [
              "Refundable",
              "The deadline and seven-day grace period have ended. The original funder can reclaim.",
            ],
            [
              "Paid",
              "A valid claim credited the designated wallet. That wallet can withdraw its pending credit.",
            ],
            [
              "Refunded",
              "The funder reclaimed the reward into their credit. The funder can withdraw it.",
            ],
          ],
        },
      },
      {
        title: "Reclaim an expired bounty",
        steps: [
          "Connect the same wallet that funded the bounty and switch to its network.",
          "Open the bounty after the completion deadline plus seven days.",
          "Choose Reclaim expired bounty and confirm the transaction.",
          "When your returned amount appears as ready to withdraw, choose Withdraw xDAI.",
          "Check the destination address and confirm the withdrawal transaction.",
        ],
      },
      {
        title: "Who controls refunds",
        paragraphs: [
          "Only the original funding wallet can reclaim an unclaimed bounty. Repo ownership does not grant refund rights. A paid bounty cannot be refunded, and there is no early-cancellation or administrator-withdrawal path. A valid claim submitted by the end of the grace period takes precedence over a later refund attempt.",
        ],
      },
      {
        title: "Keep track of your work",
        paragraphs: [
          "Use Mine after connecting your wallet, or keep the bounty URL with the issue. The app currently loads the newest 100 bounties. Explorer events provide the full contract history; older bounties may require direct contract interaction until full-history browsing is added.",
          "A GitHub API outage can block new funding checks without changing existing escrow state. A successful wallet transaction remains on-chain even if you close the page. See [Contracts and supported limits](#docs/reference/contracts) for addresses.",
        ],
      },
    ],
  },
  {
    id: "maintainers/automatic-claims",
    group: "maintainers",
    title: "Set up automatic claims",
    summary:
      "Let the collector receive GitHub emails and submit claims for contributors.",
    sections: [
      {
        title: "Choose automatic collection",
        paragraphs: [
          "When automatic collection is offered in Fund an issue, paste an issue URL and choose Automatically through the collector. Funders and contributors do not connect a GitHub account to issue.fund. A maintainer separately enables the repository integration.",
          "The setup panel reports Preparing notifications, Notifications ready, or Attention needed. Fund with automatic collection only after Notifications ready. You can explicitly choose manual collection instead; prepare your own email delivery before the merge.",
        ],
      },
      {
        title: "Enable the repository integration",
        steps: [
          "A repository maintainer follows Maintainer: enable collector from the setup panel and installs the collector’s GitHub App on the selected public repository.",
          "The App needs metadata read, issues write and pull requests write permissions. It checks the collection account’s repository role and locks completed bounty conversations. It does not run contributor code or decide what should be merged.",
          "Keep the dedicated collection account outside the repository’s collaborators and privileged organization roles. A lock cannot protect a reply credential belonging to an account that is exempt from it.",
          "Wait for a real GitHub notification to reach the mailbox. If no normal activity is expected, coordinate a harmless setup notification with the service operator. A subscription API response alone does not establish email delivery.",
          "Review the displayed claim fee, contributor’s net reward and deadline, then fund. The service rechecks readiness before wallet confirmation.",
        ],
      },
      {
        title: "After reviewing a contribution",
        paragraphs: [
          "Review and merge normally, preserving the exact bounty reference and payout wallet in the PR title and linking the funded issue. The collector needs both original native event emails.",
          "Before submitting the collected receipts, the integration locks both the completed issue and PR and checks the collector’s role. Keep these conversations locked: unlocking them or later granting the collector privileges can make already-public reply credentials usable again.",
          "A successful claim credits the wallet in the signed PR title. The contributor still authorizes a separate withdrawal transaction.",
        ],
      },
      {
        title: "If the collector needs attention",
        bullets: [
          "Do not merge until email delivery is prepared if you expect an automatic claim. Late subscription cannot recover historical original emails.",
          "Mailbox outages, missing installation permissions, gas limits and missing receipts appear in the bounty’s automatic-claim status. The reward remains governed by its on-chain completion deadline and seven-day claim window.",
          "Manual and independent receipt submissions remain possible. Read Email privacy before publishing receipts from a personal account.",
        ],
        links: [
          {
            label: "Email privacy",
            url: "#docs/reference/privacy",
          },
          {
            label: "Contributor: follow an automatic claim",
            url: "#docs/contributors/automatic-claims",
          },
          {
            label: "Contact the service operator",
            url: "mailto:turetzkyron@gmail.com",
          },
        ],
      },
    ],
  },
  {
    id: "contributors/getting-started",
    group: "contributors",
    title: "Contributor onboarding",
    summary:
      "Choose a funded issue and set up your wallet and receipt delivery.",
    sections: [
      {
        title: "Before you start the work",
        bullets: [
          "Read the issue and confirm the scope with its maintainer on GitHub.",
          "Open the bounty and check its reward, repository, target branch and completion deadline.",
          "Choose a Gnosis wallet whose withdrawal transactions you can authorize. Copy the full address, not an ENS name.",
          "Arrange access to both original GitHub event emails and read Email privacy before deciding which notification mailbox to use.",
        ],
      },
      {
        title: "Wallet and account setup",
        paragraphs: [
          "You can browse the app without connecting anything. You still use your normal GitHub account to contribute code on GitHub; you do not connect that account to this app. No separate proof of GitHub-account ownership is required.",
          "Use a browser wallet that supports Gnosis, chain ID 100. Native xDAI pays gas for claiming and withdrawing. A different wallet may relay the claim for you, but the payout wallet still needs to authorize its withdrawal and cover that transaction’s gas.",
        ],
      },
      {
        title: "Your first bounty",
        steps: [
          "Choose an open bounty from Explore bounties or follow a maintainer’s bounty link.",
          "Connect your intended payout wallet so the PR-title template contains its address.",
          "Follow Prepare your pull request and copy both title markers from the selected bounty.",
          "Enable email notifications before the maintainer merges.",
          "After the merge, follow the automatic claim status if the bounty uses the collector, or collect and submit both receipts manually. Then withdraw the credited reward.",
        ],
      },
      {
        title: "Know who gets paid",
        paragraphs: [
          "The wallet in the signed merge-time PR title receives the reward. It does not have to be the wallet submitting the claim, and it is not inferred from your GitHub username or branch name. Check the complete address before the merge; a later title edit cannot correct an already-issued receipt.",
          "Next: [Prepare your pull request](#docs/contributors/prepare-pr).",
        ],
        links: [{ label: "Explore funded issues", url: "#" }],
      },
    ],
  },
  {
    id: "contributors/prepare-pr",
    group: "contributors",
    title: "Prepare your pull request",
    summary:
      "Bind the PR to the right bounty, wallet, issue, and target branch.",
    sections: [
      {
        title: "Copy the title from the bounty page",
        paragraphs: [
          "Open the bounty, connect your payout wallet, and use Copy beside YOUR PR TITLE. Keep exactly one of each marker. Replace only the human-readable description of the fix.",
          "The following shows the shape of the title. These placeholders are not valid values; copy the real reference and address from your bounty.",
        ],
        code: "[bounty 0xYOUR_64_HEX_DIGIT_REFERENCE] [wallet 0xYOUR_40_HEX_DIGIT_ADDRESS] Describe your fix",
      },
      {
        title: "What each marker does",
        table: {
          headers: ["Marker", "Purpose"],
          rows: [
            [
              "[bounty 0x…]",
              "Binds the receipt to this chain, escrow contract and bounty number. Another bounty needs another reference.",
            ],
            [
              "[wallet 0x…]",
              "Designates the address that receives credit after a valid claim. It must be a nonzero address you can use.",
            ],
          ],
        },
      },
      {
        title: "Link the issue and target the branch",
        paragraphs: [
          "Put a closing keyword in the PR description, using the actual funded issue number. Target the branch shown on the bounty; the current flow checks the default branch when funding. Ask the maintainer to leave the issue open until the PR merge closes it.",
        ],
        code: "Closes #42",
        links: [
          {
            label: "GitHub: closing issues through a pull request",
            url: "https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue",
          },
        ],
      },
      {
        title: "Final check before review",
        bullets: [
          "Check every character of the wallet address and the complete bounty reference.",
          "Use plain ASCII text in the title and preserve the marker spelling, brackets and spaces. Encoded or unusually formatted subjects may not match the supported email template.",
          "Do not use multiple wallet or bounty markers. A single receipt cannot claim several separately funded bounties.",
          "Do not rely on a source branch, comment, PR description or commit message to carry the payout address.",
          "Finish early enough for both email events to be signed before the deadline. The seven-day grace period only extends claim submission.",
        ],
      },
      {
        title: "Arrange receipt delivery now",
        paragraphs: [
          "Subscribe to the issue and PR and make sure GitHub delivers notifications by email. Someone who will keep the original files must receive both events. Follow [Collect the email receipts](#docs/contributors/collect-emails) before the merge, not after.",
        ],
      },
    ],
  },
  {
    id: "contributors/collect-emails",
    group: "contributors",
    title: "Collect the email receipts",
    summary:
      "Enable notifications and download the two original messages the contract accepts.",
    sections: [
      {
        title: "Enable delivery before the merge",
        paragraphs: [
          "In GitHub’s notification settings, enable email for the conversations you participate in or watch. Subscribe to both the issue and PR, or configure repository watching for both Issues and Pull requests. Check the delivery address. If you perform the merge yourself, also check notifications for your own updates.",
          "You need the email originals, not only an entry in GitHub’s web notification inbox.",
        ],
        links: [
          {
            label: "Open GitHub notification settings",
            url: "https://github.com/settings/notifications",
          },
          {
            label: "GitHub: configuring notifications",
            url: "https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications",
          },
        ],
      },
      {
        title: "Find these two events",
        table: {
          headers: ["Upload slot", "Required native event"],
          rows: [
            [
              "Merged PR email",
              "The PR notification whose first event text is “Merged #N into BRANCH.” Its subject contains the payout wallet and bounty reference.",
            ],
            [
              "Issue closure email",
              "The issue notification whose first event text is “Closed #I as completed via #N.” It names the same closing PR.",
            ],
          ],
        },
        paragraphs: [
          "I, N and BRANCH stand for the real issue number, PR number and funded target branch. The verifier also authenticates GitHub’s native event footer; copying this text into a comment cannot create a valid claim.",
        ],
      },
      {
        title: "Download an original in Gmail",
        steps: [
          "Open the conversation and expand the specific merge or closure message. A thread may contain several unrelated notifications.",
          "Open the three-dot More menu belonging to that message, not the whole conversation toolbar.",
          "Choose Download message and keep the .eml file unchanged.",
          "Repeat for the other event. Give the two files recognizable names if you like; do not edit their contents.",
        ],
        links: [
          {
            label: "Google: download email messages",
            url: "https://support.google.com/mail/answer/9261412?hl=en",
          },
        ],
      },
      {
        title: "Other email clients",
        paragraphs: [
          "Use the client’s original-message or raw-source export that preserves the complete RFC 822/MIME message as an .eml file. An HTML export, PDF, screenshot, copied text or rewritten forwarded message will not work. Keep each file under 100 KB. The local check will tell you whether the original signature and event format are supported.",
        ],
      },
      {
        title: "Missing one of the emails?",
        paragraphs: [
          "Check spam, the configured notification address, and whether that exact event occurred. A manually closed issue does not produce the required “completed via PR” receipt. If another subscribed participant has the original pair, they can submit a valid claim for the designated wallet after considering that their signed email data will be public.",
          "Subscribing after the merge does not establish that you will receive the earlier originals. Do not fabricate or edit a receipt. See [Troubleshooting](#docs/reference/troubleshooting), then [Claim and withdraw](#docs/contributors/claim-and-withdraw).",
        ],
      },
    ],
  },
  {
    id: "contributors/claim-and-withdraw",
    group: "contributors",
    title: "Claim and withdraw",
    summary:
      "Check the receipts locally, submit a claim, and collect the credited reward.",
    sections: [
      {
        title: "Check the pair locally",
        steps: [
          "Open the correct bounty and select the original Merged PR email and Issue closure email.",
          "Choose Check receipts. The browser checks the existing RSA signatures and whether the events match this bounty; there is no proof generation or service to connect.",
          "Review the closing PR and the complete payout wallet shown in Signatures and bounty match.",
          "If you change either file, check the pair again. The previous review and disclosure acknowledgement are cleared.",
        ],
      },
      {
        title: "Submit the claim",
        paragraphs: [
          "Connect a Gnosis wallet with xDAI for gas. It may be a different wallet from the payout address; the review explains when you are relaying for someone else. Acknowledge the email-disclosure notice, then choose Submit claim and confirm the wallet transaction.",
          "The full signed headers and canonical bodies are sent for transaction simulation and submission. The on-chain verifier checks them independently. The UI’s successful local check is a preview; the contract decides whether the claim is valid.",
        ],
        notice:
          "Submitting makes these emails public, including your email address and notification links.",
      },
      {
        title: "Withdraw the credit",
        steps: [
          "Wait until the bounty shows Paid. Settlement creates a credit; it does not immediately send the reward to your wallet.",
          "Connect the payout wallet from the signed title. Its pending balance appears as ready to withdraw.",
          "Choose Withdraw xDAI and inspect the full destination address. Only the credited wallet can authorize a different destination.",
          "Confirm the withdrawal in that wallet and wait for confirmation. A successful withdrawal clears that wallet’s current credit balance.",
        ],
      },
      {
        title: "Retry safely",
        paragraphs: [
          "If a wallet request is rejected, retry from the review. If a transaction was sent, check its status before retrying. A repeated claim cannot pay an already-settled bounty again. If a withdrawal destination rejects the transfer, the credit remains available to its owner.",
          "Keep the original files until settlement is confirmed. Uploads are held in page memory, so reloading or leaving the bounty clears them. For rejected receipts or a missing balance, see [Troubleshooting](#docs/reference/troubleshooting).",
        ],
      },
    ],
  },
  {
    id: "contributors/automatic-claims",
    group: "contributors",
    title: "Follow an automatic claim",
    summary:
      "Check collection progress, confirm the payout wallet, and withdraw your reward.",
    sections: [
      {
        title: "Before you start",
        steps: [
          "Open the bounty and confirm with the maintainer whether automatic receipt collection is ready. If it is not ready, arrange manual notifications before the merge.",
          "Review the gross reward, success fee and contributor amount in Bounty details. The fee is deducted only after a valid claim; the amount credited to you is the displayed net reward.",
          "Copy this bounty’s exact title markers into your PR, including the Gnosis payout wallet you control. Link the funded issue in the PR description and merge into the funded target branch.",
        ],
      },
      {
        title: "Understand the status",
        table: {
          headers: ["Status", "What happens next"],
          rows: [
            [
              "Waiting for GitHub emails",
              "The collector needs the native merged-PR and linked issue-closure emails.",
            ],
            [
              "Receipts collected",
              "The relay checks eligibility, both conversation locks, and gas limits.",
            ],
            [
              "Claim submitted",
              "A transaction is pending confirmation. This is not yet a wallet payment.",
            ],
            [
              "Reward credited",
              "Connect the payout wallet and withdraw its available escrow balance.",
            ],
            [
              "Withdrawal confirmed",
              "The credited wallet withdrew after the claim.",
            ],
            [
              "Attention needed",
              "Read the recovery message. Coordinate with the maintainer/operator or use original receipts for a manual claim before the claim window closes.",
            ],
          ],
        },
      },
      {
        title: "Withdraw from the correct escrow",
        paragraphs: [
          "Your wallet may have balances in more than one escrow version. The withdrawal dialog lists them separately; each balance needs its own transaction. The original V1 balances retain their original no-fee terms.",
          "A relayer pays claim gas when it submits for you. Your wallet still needs native xDAI for withdrawal gas. Anyone can relay a valid claim, but they cannot change the signed beneficiary.",
        ],
      },
      {
        title: "If automation is unavailable",
        paragraphs: [
          "The manual upload controls remain on an open bounty. Use the two original GitHub emails and confirm their payout wallet before submission. Automatic collection does not extend the bounty’s deadline or recover emails that were never delivered.",
          "Submitting receipts publishes email data and notification links. A dedicated collector mailbox reduces exposure of your personal mailbox; it does not make receipt contents private. Read Email privacy before using your own receipts.",
        ],
        links: [
          {
            label: "Collect receipts manually",
            url: "#docs/contributors/collect-emails",
          },
          {
            label: "Email privacy",
            url: "#docs/reference/privacy",
          },
        ],
      },
    ],
  },
  {
    id: "reference/verification",
    group: "reference",
    title: "How verification works",
    summary:
      "What RSA/DKIM authenticates, and what the escrow checks before paying.",
    sections: [
      {
        title: "A signed statement from GitHub",
        paragraphs: [
          "DKIM is an email-signing standard. GitHub signs a canonical set of headers containing a hash of the canonical email body. RSA-SHA256 verification checks that those authenticated bytes have not changed and match the pinned GitHub public key.",
          "This implementation verifies that signature directly on-chain. It does not use a zero-knowledge proof. The browser prepares the canonical bytes and performs an ordinary signature check as a preview. It has no authority to release escrow funds.",
        ],
      },
      {
        title: "Checks in the contract",
        steps: [
          "Authenticate the complete signed header block with RSA and match the full body to its signed SHA-256 hash.",
          "Require the supported GitHub domain, selector, canonicalization, timestamp and signed-subject layout. Partial-body signatures and ambiguous tags are rejected.",
          "Parse the exact native merge and closure events. Check their GitHub issue_event footers, event identifiers and MIME boundaries, so a signed comment quoting an event is insufficient.",
          "Match the repository, funded issue, closing PR, target branch, payout address and chain-specific bounty reference.",
          "Check receipt timestamps, claim deadline and open status, then credit the authenticated wallet and consume the bounty.",
        ],
      },
      {
        title: "Why there is no account-ownership step",
        paragraphs: [
          "The rule is to pay the address designated in the authenticated merge-time PR title. It is not a claim that a wallet owns a GitHub username or wrote a particular commit. Anyone can relay the same receipts, but changing the payout address changes signed data and invalidates the claim.",
        ],
      },
      {
        title: "Where trust remains",
        paragraphs: [
          "GitHub remains the authority for the events it signs, and maintainers remain responsible for accepting the code. Blockchain validators execute the verifier and escrow. The design removes an app-operated payout signer, but does not make GitHub itself decentralized.",
          "The public key and verifier are fixed in this deployment. There is no administrator who can override the payout rule or replace a key. Read [Contracts and supported limits](#docs/reference/contracts) for the pinned-key, template and repository-identity limitations.",
        ],
        links: [
          {
            label: "DKIM standard: RFC 6376",
            url: "https://www.rfc-editor.org/rfc/rfc6376",
          },
          {
            label: "Protocol specification in the source repository",
            url: "https://github.com/RonTuretzky/issue.fund/blob/main/PROTOCOL.md",
          },
        ],
      },
    ],
  },
  {
    id: "reference/privacy",
    group: "reference",
    title: "Email privacy",
    summary:
      "What stays in the page and what becomes public when you submit a claim.",
    sections: [
      {
        title: "During Check receipts",
        paragraphs: [
          "For manual claims, selected files are read in your browser and checked with WebCrypto. The app does not upload them to a proving service or receipt-processing server. It does not save them to browser storage; leaving or reloading the bounty clears the selected files. Normal public GitHub and blockchain reads do not require your email contents.",
        ],
      },
      {
        title: "During claim submission",
        paragraphs: [
          "Direct DKIM verification requires the signed headers and complete canonical email bodies. These are included in the claim transaction, together with the signatures. They can contain your email address, other signed recipient fields, notification links and reply-to addresses.",
          "After you accept the disclosure and choose Submit claim, simulation can send this data to the configured RPC provider before your wallet confirms. Cancelling in the wallet does not undo that earlier disclosure. Once included on-chain, the transaction data is public and cannot be deleted through this app.",
        ],
        notice:
          "Submitting makes these emails public, including your email address and notification links.",
      },
      {
        title: "Notification links and reply addresses",
        paragraphs: [
          "Treat values embedded in notification emails as sensitive. GitHub documents reply-to addresses that identify an account and thread, and notes that unsubscribe links require the relevant signed-in account. Do not assume every token has the same permissions, or that publishing it is harmless.",
        ],
        links: [
          {
            label: "GitHub: replying to email notifications",
            url: "https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications#replying-to-email-notifications",
          },
        ],
      },
      {
        title: "Choose the receipt holder deliberately",
        paragraphs: [
          "Before subscribing, use a notification address whose eventual disclosure you accept. If someone else supplies the originals, explain that their signed email data will be published. Changing a filename is fine; editing an address, deleting a link or redacting a body breaks the authenticated data.",
          "Do not paste originals, reply addresses, notification tokens or claim calldata into a public support issue. Share an error message with sensitive data removed. Private or selectively redacted claims are not part of the current direct-verification flow.",
        ],
      },
      {
        title: "Wallet privacy",
        paragraphs: [
          "Bounty funding, designated payout wallets, credits, withdrawals and transaction amounts are also public on Gnosis. You do not provide a wallet private key to this app. Only approve transactions through your own wallet.",
        ],
      },
    ],
  },
  {
    id: "reference/troubleshooting",
    group: "reference",
    title: "Troubleshooting",
    summary:
      "Recover from repository, receipt, wallet, and withdrawal problems.",
    sections: [
      {
        title: "Repository and funding",
        table: {
          headers: ["What you see", "What to do"],
          rows: [
            [
              "Repository cannot be added",
              "Use a public, active repository with issues enabled and a supported default branch. Adding a repo never requires a GitHub connection here.",
            ],
            [
              "GitHub rate limit or connection error",
              "Wait and retry. Anonymous API checks may be limited. Do not fund until the fresh issue review succeeds.",
            ],
            [
              "Issue is closed or URL is a PR",
              "Choose an open issue URL ending in /issues/NUMBER. Check whether the issue moved or was already resolved.",
            ],
            [
              "Repository or branch changed during review",
              "Run a fresh review and inspect the new terms before confirming.",
            ],
            [
              "Already has a bounty",
              "Open the existing bounty. Additional bounties are separate escrows, not a top-up.",
            ],
          ],
        },
      },
      {
        title: "Receipt checking",
        table: {
          headers: ["What you see", "What to do"],
          rows: [
            [
              "Original .eml required or file too large",
              "Download the individual original message, keep it unchanged, and use a file under 100 KB.",
            ],
            [
              "Body hash or RSA signature is invalid",
              "Re-download the original. Edited, re-encoded, or forwarded text may no longer authenticate.",
            ],
            [
              "No native-event footer / unsupported notification",
              "Select the actual merge or linked issue-closure event. A comment, manual closure or changed GitHub template cannot substitute.",
            ],
            [
              "Wrong repository, issue, PR or branch",
              "Return to the funded bounty and check both files. They must refer to the same closing PR and target.",
            ],
            [
              "Wrong wallet or bounty reference",
              "Inspect the title authenticated at merge time. A later title edit does not rewrite the old notification.",
            ],
            [
              "Receipt outside the funding window",
              "Both signed timestamps must fall between creation and the completion deadline. Grace adds submission time only.",
            ],
            [
              "Unsupported GitHub key",
              "This deployment uses a pinned key. Another selector or rotated key requires a compatible deployment; retrying cannot change the existing verifier.",
            ],
          ],
        },
      },
      {
        title: "Transactions and balances",
        table: {
          headers: ["What you see", "What to do"],
          rows: [
            [
              "No browser wallet",
              "Open the site in a browser with an Ethereum-compatible wallet that supports Gnosis.",
            ],
            [
              "Wrong network",
              "Use the switch-network control and confirm chain 100 in the wallet.",
            ],
            [
              "Not enough gas",
              "The sending wallet needs native xDAI, including for withdrawal.",
            ],
            [
              "Transaction cancelled",
              "Retry if desired. Claim simulation may already have disclosed the signed email bytes to the RPC.",
            ],
            [
              "Claim failed or bounty already settled",
              "Check the explorer and refresh the bounty. A duplicate claim cannot pay again.",
            ],
            [
              "Paid, but no reward in the wallet",
              "Connect the designated payout wallet and withdraw its credit. Claiming and withdrawing are separate transactions.",
            ],
            [
              "Reclaim disabled",
              "Only the original funder can reclaim an unclaimed bounty, after the deadline plus seven days.",
            ],
            [
              "Withdrawal transfer failed",
              "The credit is preserved. Its owner can authorize another nonzero destination.",
            ],
          ],
        },
      },
      {
        title: "Report a problem",
        paragraphs: [
          "Include the public bounty URL, transaction hash if one exists, and the visible error message. Remove email contents, addresses you do not intend to disclose, notification links and reply tokens. Never include private keys or wallet recovery phrases.",
        ],
        links: [
          {
            label: "Open the source repository’s issue tracker",
            url: "https://github.com/RonTuretzky/issue.fund/issues",
          },
        ],
      },
    ],
  },
  {
    id: "reference/contracts",
    group: "reference",
    title: "Contracts and supported limits",
    summary:
      "Find the live contracts and understand the boundaries of the current payment rule.",
    sections: [
      {
        title: "Gnosis deployment",
        deployment: true,
        paragraphs: [
          "The public static app uses native xDAI on Gnosis, chain ID 100. The deployment manifest records the verifier, escrow, ABI and pinned public key. Contract source verification confirms published source correspondence; it is not a security audit.",
        ],
        links: [
          {
            label: "Download the current deployment manifest",
            url: "/deployment.gnosis.json",
          },
          {
            label: "Source and deployment records",
            url: "https://github.com/RonTuretzky/issue.fund/tree/main/deployments/gnosis",
          },
        ],
      },
      {
        title: "Supported receipt format",
        bullets: [
          "GitHub notifications signed for github.com with selector pf2023, RSA-SHA256 and relaxed/relaxed canonicalization.",
          "The observed native multipart merge and completed-via-PR issue-closure templates. The signed subject, event footer and MIME boundaries are checked strictly.",
          "One wallet marker and one bounty reference in the PR title, with the same repository and closing PR in the two receipts.",
          "Original upload size up to 100 KB per file; canonical headers up to 8192 bytes and full canonical body up to 65536 bytes.",
          "Public-repository onboarding, supported ASCII repository/branch names and a default branch of at most 64 characters. The live UI currently lists the newest 100 bounties.",
        ],
      },
      {
        title: "Key and repository identity",
        paragraphs: [
          "The deployment pins the observed GitHub RSA-1024 public key with exponent 65537. RSA-1024 is weaker than modern 2048-bit RSA. There is no key rotation or revocation mechanism in this escrow. A GitHub key or template change can prevent new receipts from qualifying and may require another deployment.",
          "Receipts bind the case-sensitive owner/repository name, not GitHub’s permanent numeric repository ID. Funding preflight checks identity before payment, but cannot eliminate rename or name-reuse risk during the bounty. Coordinate repository changes before funding work.",
        ],
      },
      {
        title: "Review status and transaction cost",
        paragraphs: [
          "No independent security audit has been completed. Automated tests and a real public-GitHub-to-Gnosis claim and withdrawal have passed; those checks do not guarantee the absence of defects. Review the contract and protocol before committing funds.",
          "Verification gas depends on message size. The recorded two-email Gnosis claim used 9,283,775 gas. Use the current wallet estimate to evaluate the transaction fee; that gas count is not a fixed xDAI price.",
        ],
        links: [
          {
            label: "Verification record and test scope",
            url: "https://github.com/RonTuretzky/issue.fund/blob/main/VERIFICATION.md",
          },
          {
            label: "Recorded direct-DKIM Gnosis claim",
            url: "https://gnosisscan.io/tx/0xdc00944624435a7f48e38666a3598df0768bc6cac0b7cfd0547a146281b0c053",
          },
        ],
      },
      {
        title: "Previous deployments",
        paragraphs: [
          "Existing funds stay in the immutable escrow where they were created. The previous ZK escrow is separate from this direct-DKIM deployment and requires its archived interface and original artifacts. A new deployment does not migrate or unlock old bounties.",
        ],
        links: [
          {
            label: "Archived ZK implementation",
            url: "https://github.com/RonTuretzky/issue.fund/tree/codex/archive-zk-proving",
          },
          {
            label: "Private-claim backlog and legacy requirements",
            url: "https://github.com/RonTuretzky/issue.fund/issues/1",
          },
        ],
      },
    ],
  },
  {
    id: "reference/developers",
    group: "reference",
    title: "Developer setup",
    summary:
      "Run the app locally, test direct verification, and navigate the source.",
    sections: [
      {
        title: "Run locally",
        paragraphs: [
          "Use Node 22, npm and Foundry (forge and anvil). Clone the source repository, install dependencies, and keep the chain and development app in separate terminals. The local flow uses test ETH on chain 31337; it does not send Gnosis transactions.",
        ],
        code: "git clone https://github.com/RonTuretzky/issue.fund.git\ncd issue.fund\nnpm ci --ignore-scripts\n\n# Terminal 1\nnpm run chain\n\n# Terminal 2\nnpm run deploy:local\nnpm run dev\n# Open http://127.0.0.1:5174",
      },
      {
        title: "Check changes",
        code: "npm test\nnpm run test:contracts\nnpm run test:chain\nnpm run test:ui\nnpm run docs:build\nnpm run build:gnosis",
        paragraphs: [
          "The chain and app must be running for chain/browser integration tests. Run stateful suites sequentially against the same Anvil instance. Synthetic test signing keys are used only for local verifier deployments. Genuine mail and signing keys are never part of the repository or ordinary CI.",
        ],
        links: [
          {
            label: "Full testing guide",
            url: "https://github.com/RonTuretzky/issue.fund/blob/main/TESTING.md",
          },
        ],
      },
      {
        title: "Source map",
        table: {
          headers: ["Path", "Responsibility"],
          rows: [
            [
              "shared/dkim.mjs",
              "Canonicalize email and check the existing RSA signature in the browser.",
            ],
            [
              "contracts/GithubDkimVerifier.sol",
              "Verify signed headers, the complete body hash and immutable GitHub key.",
            ],
            [
              "contracts/ReceiptPolicy.sol",
              "Parse the authenticated native events and title markers.",
            ],
            [
              "contracts/MergeBounty.sol",
              "Enforce escrow terms, credits, refunds and withdrawals.",
            ],
            [
              "src/ClaimPanel.tsx",
              "Receipt uploads, local preview, disclosure and claim submission.",
            ],
            [
              "shared/documentation.mjs",
              "Canonical guide content used by the website and exported Markdown.",
            ],
          ],
        },
      },
      {
        title: "Keep documentation in sync",
        paragraphs: [
          "Edit shared/documentation.mjs and run npm run docs:build to refresh the Markdown in docs/. The website uses the same page catalogue and content. Keep every audience’s pages in the catalogue and link new procedures from the relevant onboarding path.",
        ],
      },
      {
        title: "Hosting and contract deployment",
        paragraphs: [
          "npm run build:gnosis creates a static dist/ build. npm run deploy:pages publishes it to the repository’s codex/pages branch; GitHub Pages serves issue.fund through Cloudflare DNS. The app reads the deployment manifest and HTTPS RPC directly; it needs no local server or proof-generation software. No email or wallet secret belongs in a static build.",
          "Contract deployment creates new immutable addresses and does not migrate existing funds. The source includes a chain-100 deployment script and a pinned Breadchain Etherform workflow. See the operations and Gnosis records before deploying.",
        ],
        links: [
          {
            label: "GitHub Pages hosting and Cloudflare DNS",
            url: "https://github.com/RonTuretzky/issue.fund/blob/main/CLOUDFLARE.md",
          },
          {
            label: "Operations and recovery",
            url: "https://github.com/RonTuretzky/issue.fund/blob/main/OPERATIONS.md",
          },
          {
            label: "Gnosis deployment guide",
            url: "https://github.com/RonTuretzky/issue.fund/blob/main/GNOSIS.md",
          },
          {
            label: "Browse the source",
            url: "https://github.com/RonTuretzky/issue.fund",
          },
        ],
      },
    ],
  },
];
