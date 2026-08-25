# Crypton
Crypton is a privacy-first, zero knowledge secure sharing platform for encrypted secrets, files, and images. It uses client-side AES-256-GCM encryption, ephemeral Redis storge, self-destructing links, view limits, and image steganography for secure, temporary data sharing.


# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler🔒 Securebin: The Zero-Knowledge Digital Dead-Drop
The Problem: The Permanent Trail
Every time you share an API key, a password, a server credential, or a sensitive screenshot via Slack, Teams, or Email, you create a permanent, unencrypted liability. That data lives in chat histories and server backups forever. If that platform is ever breached, or if an employee's laptop is compromised, your sensitive data is instantly exposed.

The Solution: Securebin
Securebin is a Zero-Knowledge, fully ephemeral secure sharing platform. It allows you to share sensitive text and images using military-grade client-side encryption. Once the message is viewed or the timer expires, it is mathematically obliterated from existence.

Not even the server administrators, database hosts, or ISPs can read your data.

🔥 Why You Need This (Core Features)
Zero-Knowledge Architecture: Encryption happens inside your browser before the data ever touches the internet. The server only receives an unrecognizable, scrambled blob of data. We couldn't read your secrets even if we were legally forced to.

Multimedia Dead-Drops: Drag-and-drop support for both text and images in a single encrypted payload. Perfect for securely sharing server logs alongside a screenshot of an error.

True "Burn After Reading": The moment the recipient decrypts the message, the encrypted payload is instantly and permanently purged from the database memory.

The Snipping Tool Trap (Anti-Screenshot): Mitigates the "Analog Hole." If a user attempts to use a screen-snipping tool or clicks away from the browser, the message instantly vanishes behind a security shield. Text selection and copying are completely disabled.

The Remote Kill Switch: Sent the link to the wrong person? Use the cryptographic Delete Token provided upon creation to manually detonate the payload on the server before anyone can open it.

Time-To-Live (TTL) Hard-Fails: Powered by Redis, expiration isn't just a software rule; it's a memory-level absolute. When the timer hits zero, the database evicts the data automatically.

🏗️ Architectural Philosophy & Rationale
Securebin was engineered from the ground up to solve the "Trust" problem. Standard pastebins require you to trust their servers. Securebin only requires you to trust mathematics.

🗺️ System Architecture Data Flow
Securebin's security model relies on the fact that the decryption key never touches the server. Here is the lifecycle of a secure payload:

![Securebin Architecture](architecture.png)

1. The Cryptographic Engine (AES-256-GCM & PBKDF2)
We utilize the native Web Crypto API to ensure high-performance, sandboxed cryptography.
d
The Rationale: By relying on native browser APIs, we avoid importing vulnerable third-party crypto libraries. Data is encrypted using AES-256-GCM, providing both confidentiality and data authenticity (tamper-proofing). Keys are hardened using PBKDF2 with 100,000 iterations to completely neutralize brute-force attacks.

2. The "Split-Key" Distribution Model
When a payload is encrypted, the encryption key is intentionally left out of the server request.

The Rationale: The decryption key is generated locally and attached to the URL as a URL Fragment (the part after the #). URL fragments are never sent to the server. This creates a perfect split-key architecture: the server holds the locked vault, and the URL holds the key. The two pieces only meet inside the recipient's browser.

3. Out-of-Band Authentication
Users can optionally combine the auto-generated URL key with a manual, human-typed password.

The Rationale: If a hacker compromises an email account and finds a Securebin link, they have both the vault location and the URL key. By requiring a manual password (sent via a secondary channel like SMS or Signal), we ensure that intercepting the digital link is useless without physical knowledge of the password.

4. RAM-Only Ephemeral Storage (Redis)
Instead of a traditional SQL or NoSQL hard-drive database, the backend is strictly powered by Redis.
2. The "Split-Key" Distribution Model
When a payload is encrypted, the primary encryption key is a 16-character cryptographically secure random string. This string is intentionally left out of the server request and attached to the URL as a URL Fragment (the part after the #).

The Rationale: Browsers are designed so that URL fragments are never sent to the server. This creates a perfect split-key architecture: the server holds the locked vault, and the URL holds the key. The two pieces only meet inside the recipient's browser.

3. Frictionless Derivation (With or Without a Password)
Users can optionally combine the auto-generated URL key with a manual, human-typed password. However, even if no password is provided, the system does not downgrade security. It feeds the 16-character URL fragment (combined with an empty string) through PBKDF2 with 100,000 iterations to derive the final AES-256 key.

The Rationale: This guarantees military-grade encryption by default, without forcing the user to invent a password. If a user does add a password, it acts as Out-of-Band Authentication. An attacker intercepting the digital URL still needs the physical password sent via a secondary channel (like SMS or Signal) to unlock the payload.

4. The Anti-Bloat Philosophy (Why Less is More)
Securebin intentionally avoids traditional enterprise security bloat: there are no user accounts, no login screens, no OAuth, and no complex server-side access control lists (ACLs).

The Rationale: Traditional security features require the server to know who you are and what you are doing, which completely destroys the Zero-Knowledge model. Furthermore, heavy Identity and Access Management (IAM) adds massive friction. Securebin is a "digital dead-drop," designed to be instantaneous. Dragging the system down with complex authentication workflows would deter users and defeat the core purpose: providing a frictionless, mathematically secure alternative to pasting secrets in plain text.

5. RAM-Only Ephemeral Storage (Redis)
Instead of a traditional SQL or NoSQL hard-drive database, the backend is strictly powered by Redis.

The Rationale: Hard drives leave ghost data, even after deletion. Redis operates entirely in RAM. When a paste is "Burned" or its TTL expires, the memory allocation is instantly freed. There are no backups, no logs, and no traces left behind.


💻 Tech Stack
Frontend: React (Vite) for state management and DOM manipulation.

Cryptography: Native Web Crypto API (SubtleCrypto).

Backend: Node.js (Express) configured for static serving and REST API handling.

Database: Redis (Upstash Cloud) for sub-millisecond RAM storage and native TTL eviction.

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
