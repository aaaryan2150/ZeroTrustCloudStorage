const express = require("express");
const router = express.Router();
const {
    initRegister,
    verifyRegister,
    initAuth,
    verifyAuth,
    sendOtp,
    verifyOtp
} = require("../controllers/userControler")
const mfaLimiter = require("../middlerware/mfaLimiter")

router.get("/init-register", initRegister);
router.post("/verify-register", verifyRegister);

router.get("/init-auth", initAuth);
router.post("/verify-auth",verifyAuth);

router.post('/mfa/send-otp', mfaLimiter,sendOtp);
router.post('/mfa/verify-otp', mfaLimiter,verifyOtp );

module.exports = router;