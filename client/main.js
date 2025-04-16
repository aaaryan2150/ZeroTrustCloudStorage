import { startAuthentication, startRegistration } from "@simplewebauthn/browser"

const signupButton = document.querySelector("[data-signup]")
const loginButton = document.querySelector("[data-login]")
const emailInput = document.querySelector("[data-email]")
const modal = document.querySelector("[data-modal]")
const closeButton = document.querySelector("[data-close]")

const mfaModal = document.querySelector("[data-mfa-modal]");
const mfaCodeInput = document.querySelector("[data-mfa-code]");
const sendOtpButton = document.querySelector("[data-login]");
const verifyMfaButton = document.querySelector("[data-verify-mfa]");
const closeMfaButton = document.querySelector("[data-close-mfa]");

let currentUserEmail = null;

signupButton.addEventListener("click", signup)
loginButton.addEventListener("click", login)
closeButton.addEventListener("click", () => modal.close())
sendOtpButton.addEventListener("click", sendOtp);
verifyMfaButton.addEventListener("click", verifyOtp);
closeMfaButton.addEventListener("click", () => mfaModal.close());

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.querySelector('[data-login]');
  const mfaModal = document.querySelector('[data-mfa-modal]');
  const closeMfaBtn = document.querySelector('[data-close-mfa]');

  loginBtn.addEventListener('click', () => {
    // Show MFA modal
    mfaModal.classList.remove('hidden');
  });

  closeMfaBtn.addEventListener('click', () => {
    // Hide MFA modal
    mfaModal.classList.add('hidden');
  });
});


const SERVER_URL = "http://localhost:3000"

async function signup() {
  const email = emailInput.value

  // 1. Get challenge from server
  const initResponse = await fetch(
    `${SERVER_URL}/init-register?email=${email}`,
    { credentials: "include" }
  )
  const options = await initResponse.json()
  if (!initResponse.ok) {
    showModalText(options.error)
  }

  // 2. Create passkey
  const registrationJSON = await startRegistration(options)

  // 3. Save passkey in DB
  const verifyResponse = await fetch(`${SERVER_URL}/verify-register`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(registrationJSON),
  })

  const verifyData = await verifyResponse.json()
  if (!verifyResponse.ok) {
    showModalText(verifyData.error)
  }
  if (verifyData.verified) {
    showModalText(`Successfully registered ${email}`)
  } else {
    showModalText(`Failed to register`)
  }
}

async function login() {
  const email = emailInput.value.trim();
  currentUserEmail = email;
  if (!email) {
    showModalText("Please enter an email");
    return;
  }

  try {
    // 1. Get challenge from server
    const initResponse = await fetch(
      `${SERVER_URL}/init-auth?email=${encodeURIComponent(email)}`,
      { credentials: "include" }
    );

    if (!initResponse.ok) {
      const error = await initResponse.json();
      throw new Error(error.error || "Failed to start authentication");
    }

    const options = await initResponse.json();

    // 2. Get passkey
    const authJSON = await startAuthentication(options);

    // 3. Verify passkey with DB
    const verifyResponse = await fetch(`${SERVER_URL}/verify-auth`, {
      credentials: "include",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Send only required fields
        id: authJSON.id,
        rawId: authJSON.rawId,
        response: authJSON.response,
        type: authJSON.type,
        clientExtensionResults: authJSON.clientExtensionResults,
        transports: authJSON.transports || [],
      }),
    });

    console.log("ok1");
    

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      throw new Error(error.error || "Verification failed");
    }

    console.log("ok 2");
    

    const verifyData = await verifyResponse.json();
    if (verifyData.verified) {
      showModalText(`Successfully logged in ${email}`);
    } else {
      showModalText("Authentication failed");
    }
  } catch (error) {
    console.error("Login error:", error);
    showModalText(error.message || "Login failed");
  }
}

async function sendOtp() {
  try {
    const response = await fetch(`${SERVER_URL}/mfa/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: currentUserEmail })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    console.log("New code sent to your email");
    
    showMfaMessage("New code sent to your email");
  } catch (error) {
    showMfaMessage(error.message);
  }
}

async function verifyOtp() {
  const code = mfaCodeInput.value;
  if (!code || code.length !== 6) {
    showMfaMessage("Please enter a 6-digit code");
    return;
  }

  try {
    const response = await fetch(`${SERVER_URL}/mfa/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: currentUserEmail,
        otp: code
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || "Verification failed");
    }

    if (data.verified) {
      handleLoginSuccess(data);
      mfaModal.close();
    }
  } catch (error) {
    showMfaMessage(error.message);
  }
}



function handleLoginSuccess(data) {
  if (data.token) {
    // Store the JWT token in localStorage
    localStorage.setItem("authToken", data.token);
    
    // Show a brief success message
    showModalText(`Welcome ${data.user.email}`);
    
    // Redirect to dashboard (or another protected page)
    setTimeout(() => {
      window.location.href = "/dashboard.html";  // Change this to your desired page
    }, 1500); // Short delay to show the welcome message
  } else {
    showModalText("Authentication successful but no token received");
  }
}


function showMfaModal() {
  mfaModal.showModal();
  mfaCodeInput.value = "";
  showMfaMessage("Enter the code sent to your email");
}

function showMfaMessage(text) {
  mfaModal.querySelector("[data-mfa-message]").textContent = text;
}


function showModalText(text) {
  modal.querySelector("[data-content]").innerText = text
  modal.showModal()
}
