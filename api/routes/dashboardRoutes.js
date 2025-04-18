const express = require("express");
const router = express.Router();
const authenticateUser = require("../middlerware/authenticateUser")
const 
{
    loadUserInfo,
    uploadFiles,
    listFiles,
    downloadFiles,
    deleteFiles
} = require("../controllers/dashboardControllers")

router.get("/api/user-info", loadUserInfo);
router.post('/api/upload', authenticateUser,uploadFiles);
router.get('/api/files', authenticateUser, listFiles);
router.get('/api/download/:fileId(*)', authenticateUser, downloadFiles);
router.delete('/api/files/:fileId(*)', authenticateUser, deleteFiles);

  

module.exports = router;
