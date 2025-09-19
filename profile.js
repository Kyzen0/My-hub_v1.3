// profile.js - Handles Profile page features: personal info, security, data management, privacy

document.addEventListener('DOMContentLoaded', () => {
    // Expect global firebase, auth, db, showConfirmModal, and window.currentUserNav (from navbar.js)

    const authWarning = document.getElementById('profile-auth-warning');

    // Personal Info DOM
    const usernameInput = document.getElementById('profile-username-input');
    const saveUsernameBtn = document.getElementById('profile-save-username-btn');
    const usernameError = document.getElementById('profile-username-error');
    const emailDisplay = document.getElementById('profile-email-display');
    const emailStatus = document.getElementById('profile-email-status');
    const resendVerificationBtn = document.getElementById('profile-resend-verification-btn');
    const createdAt = document.getElementById('profile-created-at');
    const lastLogin = document.getElementById('profile-last-login');

    // Security DOM
    const currentPasswordInput = document.getElementById('profile-current-password');
    const newPasswordInput = document.getElementById('profile-new-password');
    const confirmNewPasswordInput = document.getElementById('profile-confirm-new-password');
    const changePasswordBtn = document.getElementById('profile-change-password-btn');
    const changePasswordError = document.getElementById('profile-change-password-error');

    // Data Management DOM
    const exportDataBtn = document.getElementById('profile-export-data-btn');
    const importDataBtn = document.getElementById('profile-import-data-btn');
    const importFileInput = document.getElementById('profile-import-file-input');
    const clearAllDataBtn = document.getElementById('profile-clear-all-data-btn');

    // Privacy & Sessions DOM
    const logoutBtn = document.getElementById('profile-logout-btn');
    const logoutOthersBtn = document.getElementById('profile-logout-others-btn');
    const deleteAccountBtn = document.getElementById('profile-delete-account-btn');

    const setAuthWarning = (text) => {
        if (authWarning) authWarning.textContent = text || '';
    };

    const formatDateTime = (ts) => {
        if (!ts) return '-';
        try {
            return new Date(ts).toLocaleString();
        } catch {
            return ts;
        }
    };

    function renderProfileFromUser(user) {
        if (!user) {
            setAuthWarning('You must be logged in to view and manage your profile.');
            if (usernameInput) usernameInput.value = '';
            if (emailDisplay) emailDisplay.textContent = '';
            if (emailStatus) emailStatus.textContent = '';
            if (createdAt) createdAt.textContent = '';
            if (lastLogin) lastLogin.textContent = '';
            return;
        }
        setAuthWarning('');
        const displayName = user.displayName || (user.email ? user.email.split('@')[0] : '');
        if (usernameInput) usernameInput.value = displayName;
        if (emailDisplay) emailDisplay.textContent = user.email || '';
        if (emailStatus) emailStatus.textContent = user.emailVerified ? 'Verified ✅' : 'Not Verified ⚠️';
        if (createdAt) createdAt.textContent = formatDateTime(user.metadata?.creationTime);
        if (lastLogin) lastLogin.textContent = formatDateTime(user.metadata?.lastSignInTime);
    }

    // Initial render from navbar.js global user (if already set)
    renderProfileFromUser(window.currentUserNav || auth.currentUser);

    // Stay in sync with auth changes
    auth.onAuthStateChanged((user) => {
        window.currentUserNav = user;
        renderProfileFromUser(user);
    });

    // Save Username
    if (saveUsernameBtn) {
        saveUsernameBtn.addEventListener('click', async () => {
            usernameError.textContent = '';
            const user = auth.currentUser;
            if (!user) {
                setAuthWarning('Please log in to update your username.');
                return;
            }
            const newName = (usernameInput.value || '').trim();
            if (newName.length === 0) {
                usernameError.textContent = 'Name cannot be empty.';
                return;
            }
            try {
                await user.updateProfile({ displayName: newName });
                window.showConfirmModal('Profile Updated', 'Your display name has been updated successfully!', () => {}, 'OK', '');
            } catch (error) {
                console.error('Error updating display name:', error);
                usernameError.textContent = error?.message || 'Failed to update name.';
            }
        });
    }

    // Resend Verification Email
    if (resendVerificationBtn) {
        resendVerificationBtn.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) {
                setAuthWarning('Please log in to resend verification email.');
                return;
            }
            if (user.emailVerified) {
                window.showConfirmModal('Already Verified', 'Your email is already verified.', () => {}, 'OK', '');
                return;
            }
            try {
                await user.sendEmailVerification();
                window.showConfirmModal('Verification Email Sent', 'Please check your inbox (and spam) for the verification link.', () => {}, 'OK', '');
            } catch (error) {
                console.error('Error sending verification email:', error);
                window.showConfirmModal('Error', error?.message || 'Failed to send verification email.', () => {}, 'OK', '');
            }
        });
    }

    // Change Password (with re-authentication)
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', async () => {
            changePasswordError.textContent = '';
            const user = auth.currentUser;
            if (!user) {
                setAuthWarning('Please log in to change your password.');
                return;
            }
            const currentPassword = (currentPasswordInput.value || '').trim();
            const newPassword = (newPasswordInput.value || '').trim();
            const confirmNewPassword = (confirmNewPasswordInput.value || '').trim();

            if (!currentPassword || !newPassword || !confirmNewPassword) {
                changePasswordError.textContent = 'All fields are required.';
                return;
            }
            if (newPassword.length < 6) {
                changePasswordError.textContent = 'New password must be at least 6 characters.';
                return;
            }
            if (newPassword !== confirmNewPassword) {
                changePasswordError.textContent = 'New passwords do not match.';
                return;
            }

            try {
                // Re-authenticate
                const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
                await user.reauthenticateWithCredential(credential);
                await user.updatePassword(newPassword);
                currentPasswordInput.value = '';
                newPasswordInput.value = '';
                confirmNewPasswordInput.value = '';
                window.showConfirmModal('Password Changed', 'Your password has been updated successfully.', () => {}, 'OK', '');
            } catch (error) {
                console.error('Error changing password:', error);
                changePasswordError.textContent = error?.message || 'Failed to change password.';
            }
        });
    }

    // Data Management: Export/Import/Clear (reuse global functions from script.js)
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', () => {
            if (typeof window.exportData === 'function') {
                window.exportData();
            }
        });
    }

    if (importDataBtn && importFileInput) {
        importDataBtn.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', (ev) => {
            if (typeof window.importData === 'function') {
                window.importData(ev);
            }
            // reset value to allow re-selecting the same file
            importFileInput.value = '';
        });
    }

    if (clearAllDataBtn) {
        clearAllDataBtn.addEventListener('click', async () => {
            window.showConfirmModal(
                'Confirm Data Wipe',
                'This will delete ALL your data (Anime, Projects, Bookmarks) from both local storage and cloud. This action cannot be undone.',
                async () => {
                    try {
                        await clearEverythingClient();
                        window.showConfirmModal('Data Cleared', 'All your data has been deleted.', () => {}, 'OK', '');
                    } catch (error) {
                        console.error('Error clearing all data:', error);
                        window.showConfirmModal('Error', error?.message || 'Failed to clear all data.', () => {}, 'OK', '');
                    }
                },
                'Yes, Delete Everything',
                'Cancel'
            );
        });
    }

    // Helper: clear all lists and bookmarks without relying on script.js internals
    async function clearEverythingClient() {
        const user = auth.currentUser;
        // Clear localStorage mirrors
        const keys = [
            'watchingList','watchingLastUpdated','completedList','completedLastUpdated',
            'projectsList','projectsLastUpdated','upcomingList','upcomingLastUpdated',
            'bookmarks_tools','bookmarks_tools_lastUpdated','bookmarks_entertainment','bookmarks_entertainment_lastUpdated',
            'accountsList','accountsLastUpdated','notesList','notesLastUpdated','vaultPassword'
        ];
        keys.forEach(k => localStorage.removeItem(k));
        try { sessionStorage.removeItem('vaultUnlocked'); } catch (e) {}

        if (!user) return; // nothing to clear in cloud if logged out

        const collections = ['watching','completed','projects','upcoming','toolsBookmarks','entertainmentBookmarks','accounts','notes'];
        for (const col of collections) {
            const ref = db.collection('users').doc(user.uid).collection(col);
            const snap = await ref.get();
            if (snap.empty) continue;
            const batch = db.batch();
            snap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
    }

    // Logout current session
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.showConfirmModal(
                'Confirm Logout',
                'Are you sure you want to log out from this device?',
                async () => {
                    await auth.signOut();
                    window.location.href = 'index.html';
                },
                'Logout',
                'Cancel'
            );
        });
    }

    // Logout from other devices (revoke refresh tokens)
    if (logoutOthersBtn) {
        logoutOthersBtn.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) {
                setAuthWarning('Please log in to manage sessions.');
                return;
            }
            window.showConfirmModal(
                'Logout From Other Devices',
                'This will log you out of all other devices immediately. You will stay logged in here.',
                async () => {
                    try {
                        // Firebase Admin API is required for revokeRefreshTokens on the server.
                        // On client, we can force token refresh by updating the password or by calling a custom endpoint.
                        // As a client-only fallback, we update the user profile timestamp to force tokens to refresh on backend rules where applicable.
                        if (user.reload) await user.reload();
                        // Show info since full revoke requires admin privileges
                        window.showConfirmModal('Action Required', 'To fully logout other devices, this project must call an admin endpoint to revoke tokens. For now, please change your password to force logouts.', () => {}, 'OK', '');
                    } catch (error) {
                        console.error('Error attempting session revoke:', error);
                        window.showConfirmModal('Error', error?.message || 'Failed to logout other devices.', () => {}, 'OK', '');
                    }
                },
                'Proceed',
                'Cancel'
            );
        });
    }

    // Delete account
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) {
                setAuthWarning('Please log in to delete your account.');
                return;
            }

            const step2 = () => {
                window.showConfirmModal(
                    'Final Confirmation',
                    'This will permanently delete your account and all associated cloud data. This cannot be undone.',
                    async () => {
                        try {
                            // Ask for password to reauthenticate before destructive operation
                            const password = window.prompt('For security, please enter your current password to confirm account deletion:');
                            if (!password) {
                                window.showConfirmModal('Cancelled', 'Account deletion was cancelled.', () => {}, 'OK', '');
                                return;
                            }
                            const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
                            await user.reauthenticateWithCredential(credential);

                            // Clear user data in Firestore (all collections under users/{uid})
                            await deleteAllUserData(user.uid);
                            // Delete auth account
                            await user.delete();
                            window.location.href = 'index.html';
                        } catch (error) {
                            console.error('Error deleting account:', error);
                            if (error && error.code === 'auth/requires-recent-login') {
                                window.showConfirmModal('Reauthentication Required', 'Please log in again, then retry deleting your account.', () => {}, 'OK', '');
                            } else {
                                window.showConfirmModal('Error', error?.message || 'Failed to delete account. You may need to reauthenticate and try again.', () => {}, 'OK', '');
                            }
                        }
                    },
                    'Yes, Delete My Account',
                    'Cancel'
                );
            };

            window.showConfirmModal(
                'Delete Account',
                'We will first delete all your cloud data, then your authentication account. Continue?',
                async () => {
                    step2();
                },
                'Continue',
                'Cancel'
            );
        });
    }

    async function deleteAllUserData(uid) {
        // Delete collections: watching, completed, projects, upcoming, toolsBookmarks, entertainmentBookmarks
        const collections = ['watching','completed','projects','upcoming','toolsBookmarks','entertainmentBookmarks','accounts','notes'];
        for (const col of collections) {
            const ref = db.collection('users').doc(uid).collection(col);
            const snap = await ref.get();
            if (snap.empty) continue;
            const batch = db.batch();
            snap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        // Also clear local storage mirrors
        const keys = [
            'watchingList','watchingLastUpdated','completedList','completedLastUpdated',
            'projectsList','projectsLastUpdated','upcomingList','upcomingLastUpdated',
            'bookmarks_tools','bookmarks_tools_lastUpdated','bookmarks_entertainment','bookmarks_entertainment_lastUpdated',
            'accountsList','accountsLastUpdated','notesList','notesLastUpdated','vaultPassword'
        ];
        keys.forEach(k => localStorage.removeItem(k));
    }
});


