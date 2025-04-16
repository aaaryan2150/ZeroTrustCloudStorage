# Zero-Trust Cloud Storage with Multi-Factor Biometric Authentication

Zero-Trust Cloud Storage with Multi-Factor Biometric Authentication is a secure cloud storage platform that embraces zero-trust security principles and modern biometric passwordless login using the WebAuthn API. The system ensures files are safely stored and accessed only by authenticated users through strong multi-factor biometric authentication. Files are stored on Vercel Blob, providing serverless, scalable cloud storage.

## Table of Contents
- [About](#about)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Setup](#setup)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## About

This project leverages zero-trust architecture by enforcing strict authentication and authorization at every step. It integrates the WebAuthn API for biometric and passwordless login, enhancing security and user experience. The backend is built with Node.js and Express, managing authentication, user data, and file metadata stored in MongoDB. The actual file storage is handled by Vercel Blob, ensuring scalable and secure cloud object storage.

## Tech Stack

### Backend (`/api`)

- **Node.js** & **Express** — Core backend server framework
- **@simplewebauthn/server** — WebAuthn server-side implementation for biometric authentication
- **@vercel/blob** — Interface to Vercel Blob storage for secure file uploads and downloads
- **mongoose** — MongoDB object modeling for storing user data and file metadata
- **jsonwebtoken** — JWT creation and verification for session management
- **express-fileupload** — Handling file uploads
- **cors** — Enabling Cross-Origin Resource Sharing
- **cookie-parser** — Parsing cookies for authentication
- **express-rate-limit** — Rate limiting to protect API endpoints
- **dotenv** — Environment variables management
- **nodemailer** — Email sending (e.g., account verification, notifications)
- **uuid** — Generating unique IDs
- **base64url** — Encoding utilities
- **serverless-http** — For serverless deployments (optional)
- **nodemon** (dev dependency) — Development utility for hot reloading

### Frontend (`/client`)

- **WebAuthn API** — Native browser API for biometric and passwordless authentication
- **Vanilla JavaScript, HTML, CSS** — Frontend interface for user interactions
- **Axios** — HTTP client for API communication

### Infrastructure & Storage

- **MongoDB** — Database for user accounts and file metadata
- **Vercel Blob** — Serverless and scalable object storage for files
- **Vercel** — Hosting and deployment platform

## Features

- **Zero-Trust Security Model:** Continuous verification and no implicit trust for all actions.
- **Multi-Factor Biometric Authentication:** Uses the WebAuthn API to enable passwordless, biometric-based login for enhanced security.
- **Passwordless Login:** Eliminates traditional password risks by using biometric or hardware security keys.
- **Secure File Uploads & Downloads:** Files are stored privately on Vercel Blob and accessible only with valid JWT authentication.
- **User Dashboard:** Intuitive frontend to upload, manage, and download files.
- **Robust API Security:** Includes rate limiting, JWT authentication, and strict CORS policies.
- **Email Notifications:** Integrated with Nodemailer for account-related emails.
- **Serverless Ready:** Compatible with serverless deployment environments using `serverless-http`.

## Setup

### Prerequisites

- Node.js v16 or higher
- MongoDB instance (local or managed)
- Vercel account with Blob storage enabled

### Installation Steps

1. **Clone the repository:**
- git clone https://github.com/aaaryan2150/ZeroTrustCloudStorage.git
- cd ZeroTrustCloudStorage

2. **Backend setup:**
- cd api
- npm install

3. **Configure environment variables:**

- Create a `.env` file in the `api` folder and define variables such as:

- - EMAIL_USER=<your_email_address>
- - EMAIL_APP_PASSWORD=<your_email_password_or_app_password>
- - JWT_SECRET==<your_jwt_secret_key>
- - BLOB_READ_WRITE_TOKEN=<your_vercel_blob_token>
- - MONGO_URI=<your_mongodb_connection_string>


4. **Start the backend server:**
- npm run dev

- This uses `nodemon` for auto-reloading during development.

5. **Frontend setup:**
- Open the `client/index.html` file in a modern browser or serve it with a static file server (e.g., `npx serve client`).

## Usage

- **Register and Login:** Use biometric authentication (fingerprint, face ID, or hardware security key) through WebAuthn for seamless passwordless login.
- **File Management:** Upload, download, and delete files securely via the frontend dashboard.
- **Secure API Interaction:** All API requests require a valid JWT obtained after biometric authentication.
- **Cloud Storage:** Files are stored securely with Vercel Blob and associated metadata is stored in MongoDB.

## Contributing

Contributions, bug reports, and feature requests are welcome!  
Feel free to fork the repo, create a feature branch, and submit a pull request.  
Please ensure code readability, add comments, and follow best practices.







