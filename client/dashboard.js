document.addEventListener('DOMContentLoaded', function() {
    // Check if user is authenticated
    const token = localStorage.getItem('authToken');
    if (!token) {
        // Redirect to login page if no token found
        window.location.href = '/index.html';
        return;
    }
    
    // Load user info and files
    loadUserInfo();
    loadFiles();
    
    // Set up logout button
    document.getElementById('logout-button').addEventListener('click', logout);
    
    // Set up upload button
    document.getElementById('upload-button').addEventListener('click', uploadFiles);
});

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


async function loadUserInfo() {
    try {
        const token = localStorage.getItem('authToken');
        
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        const response = await fetch('http://localhost:3000/api/user-info', {
            method: 'GET',  // Explicitly set the method
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Server response:', response.status, errorData);
            throw new Error('Failed to load user info');
        }
        
        const userData = await response.json();
        document.getElementById('user-info').innerHTML = `
            <p>Email: ${userData.email}</p>
            <p>User ID: ${userData.id}</p>
        `;
    } catch (error) {
        console.error('Error loading user info:', error);
        document.getElementById('user-info').innerHTML = `
            <p class="error">Error loading user data. Please <a href="#" onclick="logout(); return false;">log in</a> again.</p>
        `;
    }
}

function logout() {
    localStorage.removeItem('authToken');
    window.location.href = '/index.html';
}

// async function loadFiles() {
//     try {
//         const token = localStorage.getItem('authToken');
//         const response = await fetch('http://localhost:3000/api/files', {
//             headers: {
//                 'Authorization': `Bearer ${token}`
//             }
//         });
        
//         if (!response.ok) {
//             throw new Error('Failed to load files');
//         }
        
//         const files = await response.json();
//         const fileList = document.getElementById('files');
        
//         if (files.length === 0) {
//             fileList.innerHTML = '<li>No files uploaded yet</li>';
//             return;
//         }
        
//         fileList.innerHTML = files.map(file => `
//             <li>
//                 <strong>${file.name}</strong> (${formatFileSize(file.size)})
//                 <button class="download-button" data-id="${file.id}">Download</button>
//                 <button class="delete-button" data-id="${file.id}">Delete</button>
//             </li>
//         `).join('');
        
//         // Add event listeners to the buttons
//         document.querySelectorAll('.download-button').forEach(button => {
//             button.addEventListener('click', () => downloadFile(button.dataset.id));
//         });
        
//         document.querySelectorAll('.delete-button').forEach(button => {
//             button.addEventListener('click', () => deleteFile(button.dataset.id));
//         });
//     } catch (error) {
//         console.error('Error loading files:', error);
//         document.getElementById('files').innerHTML = '<li class="error">Error loading files. Please try again.</li>';
//     }
// }

async function loadFiles() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('http://localhost:3000/api/files', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load files');
        }
        
        const files = await response.json();
        const fileList = document.getElementById('files');
        
        if (files.length === 0) {
            fileList.innerHTML = '<li>No files uploaded yet</li>';
            return;
        }
        
        // --- UI improvement here ---
        fileList.innerHTML = files.map(file => `
            <li>
                <div>
                    <strong>${file.name}</strong> (${formatFileSize(file.size)})
                </div>
                <div class="file-actions">
                    <button class="download-button" data-id="${file.id}">Download</button>
                    <button class="delete-button" data-id="${file.id}">Delete</button>
                </div>
            </li>
        `).join('');
        // --- end UI improvement ---
        
        // Add event listeners to the buttons
        document.querySelectorAll('.download-button').forEach(button => {
            button.addEventListener('click', () => downloadFile(button.dataset.id));
        });
        
        document.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', () => deleteFile(button.dataset.id));
        });
    } catch (error) {
        console.error('Error loading files:', error);
        document.getElementById('files').innerHTML = '<li class="error">Error loading files. Please try again.</li>';
    }
}


async function uploadFiles() {
    const fileInput = document.getElementById('file-input');
    const files = fileInput.files;
    
    if (files.length === 0) {
        alert('Please select files to upload');
        return;
    }
    
    // Show loading indicator
    const uploadStatus = document.getElementById('upload-status') || 
                         document.createElement('div');
    uploadStatus.id = 'upload-status';
    uploadStatus.innerHTML = 'Uploading files...';
    // document.querySelector('.upload-container').appendChild(uploadStatus);
    document.querySelector('.file-upload').appendChild(uploadStatus);
    
    const token = localStorage.getItem('authToken');
    const formData = new FormData();
    
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }
    
    try {
        const response = await fetch('http://localhost:3000/api/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Upload failed');
        }
        
        const result = await response.json();
        
        uploadStatus.innerHTML = 'Files uploaded successfully!';
        uploadStatus.classList.add('success');
        setTimeout(() => {
            uploadStatus.remove();
        }, 3000);
        
        fileInput.value = ''; // Clear the file input
        loadFiles(); // Refresh the file list
    } catch (error) {
        console.error('Error uploading files:', error);
        uploadStatus.innerHTML = `Upload failed: ${error.message}`;
        uploadStatus.classList.add('error');
    }
}

async function downloadFile(fileId) {
    const token = localStorage.getItem('authToken');
    
    try {
        // First get a signed URL for the file
        console.log(fileId);
        
        const response = await fetch(`http://localhost:3000/api/download/${fileId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to get download link');
        }
        
        const data = await response.json();
        
        // Open the download URL in a new tab or trigger download
        window.open(data.url, '_blank');
    } catch (error) {
        console.error('Error downloading file:', error);
        alert(`Download failed: ${error.message}`);
    }
}

async function deleteFile(fileId) {
    if (!confirm('Are you sure you want to delete this file?')) {
        return;
    }
    
    const token = localStorage.getItem('authToken');
    
    try {
        const response = await fetch(`http://localhost:3000/api/files/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Delete failed');
        }
        
        alert('File deleted successfully');
        loadFiles(); // Refresh the file list
    } catch (error) {
        console.error('Error deleting file:', error);
        alert(`Delete failed: ${error.message}`);
    }
}
