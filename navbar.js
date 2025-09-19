// navbar.js - Handles global UI elements like navigation, theme, and authentication modals

document.addEventListener('DOMContentLoaded', () => {
    // Firebase 'auth' and 'db' objects are expected to be globally available
    // from the Firebase SDKs initialized in the HTML file.
    // Ensure firebase is initialized BEFORE this script runs.

    // --- DOM Elements for Authentication Modals (Auth, Account Settings, Password Reset) ---
    const authModal = document.getElementById('auth-modal');
    const closeModalBtn = document.querySelector('#auth-modal .close-modal-btn');

    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const loginBtn = document.getElementById('login-btn');
    const loginErrorMessage = document.getElementById('login-error-message');
    const loginPasswordToggle = document.getElementById('login-password-toggle');
    const forgotPasswordLink = document.getElementById('forgot-password-link');

    const signupEmailInput = document.getElementById('signup-email');
    const signupNameInput = document.getElementById('signup-name');
    const signupPasswordInput = document.getElementById('signup-password');
    const signupConfirmPasswordInput = document.getElementById('signup-confirm-password');
    const signupBtn = document.getElementById('signup-btn');
    const signupErrorMessage = document.getElementById('signup-error-message');
    const signupPasswordToggle1 = document.getElementById('signup-password-toggle-1');
    const signupPasswordToggle2 = document.getElementById('signup-password-toggle-2');

    const showSignupLink = document.getElementById('show-signup');
    const showLoginLink = document.getElementById('show-login');

    const accountIcon = document.getElementById('account-icon');
    const welcomeMessage = document.getElementById('welcome-message');

    // Ensure the account button remains an icon (do not overwrite inner HTML)
    if (accountIcon) {
        accountIcon.title = 'Settings';
        accountIcon.classList.remove('auth-status-btn', 'auth-status-loggedin');
    }

    // Account Settings Modal DOM Elements
    const accountSettingsModal = document.getElementById('account-settings-modal');
    const closeAccountSettingsModalBtn = document.getElementById('close-account-settings-modal-btn');
    const accountDisplayNameInput = document.getElementById('account-display-name');
    const accountEmailDisplay = document.getElementById('account-email-display');
    const updateProfileBtn = document.getElementById('update-profile-btn');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const accountSettingsErrorMessage = document.getElementById('account-settings-error-message');

    // Password Reset Modal DOM Elements
    const passwordResetModal = document.getElementById('password-reset-modal');
    const closeResetModalBtn = document.getElementById('close-reset-modal-btn');
    const resetEmailInput = document.getElementById('reset-email-input');
    const sendResetEmailBtn = document.getElementById('send-reset-email-btn');
    const resetErrorMessage = document.getElementById('reset-error-message');

    // Mobile theme toggle link (within hamburger menu)
    const mobileThemeToggleLink = document.getElementById('mobile-theme-toggle-link');

    // Global variable to hold current user (accessible to other scripts via window.currentUserNav)
    window.currentUserNav = null;

    // --- Helper for parsing Firebase errors (scoped to navbar.js) ---
    function getFirebaseErrorMessage(error) {
        let message = 'An unknown error occurred. Please try again.';
        if (error && error.code) {
            switch (error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-login-credentials':
                    message = 'Invalid email or password.';
                    break;
                case 'auth/invalid-email':
                    message = 'Please enter a valid email address.';
                    break;
                case 'auth/user-disabled':
                    message = 'Your account has been disabled.';
                    break;
                case 'auth/email-already-in-use':
                    message = 'This email is already in use.';
                    break;
                case 'auth/weak-password':
                    message = 'The password is too weak (min 6 characters).';
                    break;
                case 'auth/network-request-failed':
                    message = 'Network error. Please check your internet connection.';
                    break;
                case 'auth/requires-recent-login':
                    message = 'Please log in again to perform this action (e.g., change password).';
                    break;
                case 'auth/too-many-requests':
                    message = 'Too many failed attempts. Please try again later.';
                    break;
                default:
                    message = error.message;
                    break;
            }
        } else if (error && error.message) {
            message = error.message;
        }
        return message;
    }

    // --- Custom Confirmation Modal Logic (Made global) ---
    // This needs to be defined once and globally as it's used by both navbar.js and script.js
    const customConfirmModal = document.getElementById('customConfirmModal');
    const confirmModalTitle = document.getElementById('confirmModalTitle');
    const confirmModalMessage = document.getElementById('confirmModalMessage');
    const confirmModalOK = document.getElementById('confirmModalOK');
    const confirmModalCancel = document.getElementById('confirmModalCancel');

    window.showConfirmModal = function(title, message, onConfirm, okText = 'Confirm', cancelText = 'Cancel') {
        if (!customConfirmModal) {
            // Fallback to native confirm if modal HTML is not present
            if (confirm(message) && onConfirm) {
                onConfirm();
            }
            return;
        }
        confirmModalTitle.textContent = title;
        confirmModalMessage.textContent = message;
        confirmModalOK.textContent = okText || '';
        confirmModalCancel.textContent = cancelText || '';

        confirmModalOK.onclick = null;
        confirmModalCancel.onclick = null;

        confirmModalOK.onclick = () => {
            customConfirmModal.classList.remove('active');
            if (onConfirm) {
                onConfirm();
            }
        };

        confirmModalCancel.onclick = () => {
            customConfirmModal.classList.remove('active');
        };

        // Toggle buttons based on provided labels
        confirmModalOK.style.display = okText ? 'inline-block' : 'none';
        confirmModalCancel.style.display = cancelText ? 'inline-block' : 'none';
        customConfirmModal.classList.add('active');
    };


    // --- Firebase Auth State Listener (for UI elements in navbar) ---
    // This is distinct from the one in script.js which focuses on data synchronization.
    auth.onAuthStateChanged(user => {
        window.currentUserNav = user; // Update the global var
        if (user) {
            console.log('[navbar.js] User logged in:', user.email);
            if (welcomeMessage) {
                const displayName = user.displayName || user.email.split('@')[0];
                welcomeMessage.textContent = `Welcome, ${displayName}!`;
            }
            // Keep the settings icon; only update tooltip
            if (accountIcon) {
                accountIcon.classList.remove('auth-status-btn', 'auth-status-loggedin');
                accountIcon.title = 'Settings';
            }
        } else {
            console.log('[navbar.js] User logged out.');
            if (welcomeMessage) {
                welcomeMessage.textContent = '';
            }
            // Keep the settings icon; only update tooltip
            if (accountIcon) {
                accountIcon.classList.remove('auth-status-loggedin');
                accountIcon.title = 'Login or Sign Up';
            }
        }
        // Hide modals if auth state changes (e.g., user logs out via settings)
        if (authModal) authModal.classList.remove('active');
        if (accountSettingsModal) accountSettingsModal.classList.remove('active');
        if (passwordResetModal) passwordResetModal.classList.remove('active');
    });

    // --- Offline Authentication Check ---
    // Check for offline user data on page load
    function checkOfflineUser() {
        try {
            const userData = localStorage.getItem('offlineUser');
            if (userData) {
                const user = JSON.parse(userData);
                // Check if the stored user data is not too old (24 hours)
                if (Date.now() - user.timestamp < 24 * 60 * 60 * 1000) {
                    console.log('[navbar.js] Found offline user:', user.email);
                    // Update the global user variable for offline access
                    window.currentUserNav = user;
                    // Update UI
                    if (welcomeMessage) {
                        const displayName = user.displayName || user.email.split('@')[0];
                        welcomeMessage.textContent = `Welcome, ${displayName}! (Offline)`;
                    }
                    if (accountIcon) {
                        accountIcon.title = 'Settings (Offline)';
                    }
                    return true;
                }
            }
        } catch (e) {
            console.warn('Could not check offline user:', e);
        }
        return false;
    }

    // Check for offline user on page load
    if (!navigator.onLine) {
        checkOfflineUser();
    }

    // Listen for online/offline events to update UI
    window.addEventListener('online', () => {
        console.log('[navbar.js] App is now online');
        // Remove offline indicators
        if (welcomeMessage && window.currentUserNav) {
            const displayName = window.currentUserNav.displayName || window.currentUserNav.email.split('@')[0];
            welcomeMessage.textContent = `Welcome, ${displayName}!`;
        }
        if (accountIcon && window.currentUserNav) {
            accountIcon.title = 'Settings';
        }
    });

    window.addEventListener('offline', () => {
        console.log('[navbar.js] App is now offline');
        // Add offline indicators
        if (welcomeMessage && window.currentUserNav) {
            const displayName = window.currentUserNav.displayName || window.currentUserNav.email.split('@')[0];
            welcomeMessage.textContent = `Welcome, ${displayName}! (Offline)`;
        }
        if (accountIcon && window.currentUserNav) {
            accountIcon.title = 'Settings (Offline)';
        }
    });

    // --- Password Visibility Toggle Function ---
    function setupPasswordToggle(inputElement, toggleElement) {
        if (inputElement && toggleElement) {
            toggleElement.addEventListener('click', () => {
                const icon = toggleElement.querySelector('i');
                if (inputElement.type === 'password') {
                    inputElement.type = 'text';
                    if (icon) {
                        icon.classList.remove('fa-eye');
                        icon.classList.add('fa-eye-slash');
                    }
                } else {
                    inputElement.type = 'password';
                    if (icon) {
                        icon.classList.remove('fa-eye-slash');
                        icon.classList.add('fa-eye');
                    }
                }
            });
        }
    }

    // Apply password toggle to all relevant inputs
    setupPasswordToggle(loginPasswordInput, loginPasswordToggle);
    setupPasswordToggle(signupPasswordInput, signupPasswordToggle1);
    setupPasswordToggle(signupConfirmPasswordInput, signupPasswordToggle2);

    // --- Account Icon / Authentication Modal Control ---
    if (accountIcon) {
        accountIcon.addEventListener('click', () => {
            // Check if user is logged in (online or offline)
            if (window.currentUserNav) { // Logged in → navigate to profile page
                window.location.href = 'profile.html';
            } else {
                // Not logged in → open auth modal if present, otherwise redirect to home and open there
                if (authModal) {
                    authModal.classList.add('active');
                    loginForm.style.display = 'block';
                    signupForm.style.display = 'none';
                    loginErrorMessage.textContent = '';
                    signupErrorMessage.textContent = '';
                    loginEmailInput.value = '';
                    loginPasswordInput.value = '';
                    if (signupNameInput) signupNameInput.value = '';
                    setTimeout(() => loginEmailInput.focus(), 300);
                } else {
                    try { sessionStorage.setItem('openAuthOnLoad', '1'); } catch (e) {}
                    window.location.href = 'index.html';
                }
            }
        });
    }

    // Close main auth modal
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (authModal) authModal.classList.remove('active');
        });
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) {
                authModal.classList.remove('active');
            }
        });
    }

    // Close Account Settings Modal
    if (closeAccountSettingsModalBtn) {
        closeAccountSettingsModalBtn.addEventListener('click', () => {
            if (accountSettingsModal) accountSettingsModal.classList.remove('active');
        });
        if (accountSettingsModal) {
            accountSettingsModal.addEventListener('click', (e) => {
                if (e.target === accountSettingsModal) {
                    accountSettingsModal.classList.remove('active');
                }
            });
        }
    }

    // --- Form Switching Logic ---
    function switchToSignup() {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        loginErrorMessage.textContent = '';
        signupErrorMessage.textContent = '';
        loginEmailInput.value = '';
        loginPasswordInput.value = '';
        signupEmailInput.value = '';
        if (signupNameInput) signupNameInput.value = '';
        signupPasswordInput.value = '';
        signupConfirmPasswordInput.value = '';
        signupEmailInput.focus();
        const loginTab = document.getElementById('auth-tab-login');
        const signupTab = document.getElementById('auth-tab-signup');
        if (loginTab && signupTab) {
            loginTab.classList.remove('active');
            signupTab.classList.add('active');
        }
    }
    if (showSignupLink) {
        showSignupLink.addEventListener('click', (e) => { e.preventDefault(); switchToSignup(); });
    }

    function switchToLogin() {
        signupForm.style.display = 'none';
        loginForm.style.display = 'block';
        loginErrorMessage.textContent = '';
        signupErrorMessage.textContent = '';
        loginEmailInput.value = '';
        loginPasswordInput.value = '';
        signupEmailInput.value = '';
        if (signupNameInput) signupNameInput.value = '';
        signupPasswordInput.value = '';
        signupConfirmPasswordInput.value = '';
        loginEmailInput.focus();
        const loginTab = document.getElementById('auth-tab-login');
        const signupTab = document.getElementById('auth-tab-signup');
        if (loginTab && signupTab) {
            signupTab.classList.remove('active');
            loginTab.classList.add('active');
        }
    }
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => { e.preventDefault(); switchToLogin(); });
    }

    // Auth tabs
    const authTabLogin = document.getElementById('auth-tab-login');
    const authTabSignup = document.getElementById('auth-tab-signup');
    if (authTabLogin) authTabLogin.addEventListener('click', switchToLogin);
    if (authTabSignup) authTabSignup.addEventListener('click', switchToSignup);

    // Handle User Login (Auth operations are here for the modal, `onAuthStateChanged` updates global state)
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = loginEmailInput.value.trim();
            const password = loginPasswordInput.value.trim();
            loginErrorMessage.textContent = ''; // Clear previous errors

            if (!email || !password) {
                loginErrorMessage.textContent = 'Please enter both email and password.';
                return;
            }

            try {
                await auth.signInWithEmailAndPassword(email, password);
                // onAuthStateChanged listener handles UI updates and modal closing
            } catch (error) {
                console.error('Login error:', error);
                loginErrorMessage.textContent = getFirebaseErrorMessage(error);
            } finally {
                loginPasswordInput.value = ''; // Clear password field for security
            }
        });
    }

    // Handle User Signup
    if (signupBtn) {
        signupBtn.addEventListener('click', async () => {
            const name = signupNameInput ? signupNameInput.value.trim() : '';
            const email = signupEmailInput.value.trim();
            const password = signupPasswordInput.value.trim();
            const confirmPassword = signupConfirmPasswordInput.value.trim();
            signupErrorMessage.textContent = '';

            if (!email || !password || !confirmPassword) {
                signupErrorMessage.textContent = 'Please fill in all required fields.';
                return;
            }
            if (password.length < 6) {
                signupErrorMessage.textContent = 'Password must be at least 6 characters long.';
                return;
            }
            if (password !== confirmPassword) {
                signupErrorMessage.textContent = 'Passwords do not match.';
                return;
            }

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                if (name) {
                    await user.updateProfile({ displayName: name });
                }
                await user.sendEmailVerification();

                window.showConfirmModal(
                    'Account Created!',
                    'Your account has been created successfully. Please check your email inbox (and spam folder) for a verification link to activate your account and enable cloud saving.',
                    () => {
                        if (authModal) authModal.classList.remove('active');
                    },
                    'OK',
                    ''
                );

            } catch (error) {
                console.error('Signup error:', error);
                signupErrorMessage.textContent = getFirebaseErrorMessage(error);
            } finally {
                if (signupNameInput) signupNameInput.value = '';
                signupPasswordInput.value = '';
                signupConfirmPasswordInput.value = '';
            }
        });
    }

    // Handle Profile Update (only display name)
    if (updateProfileBtn) {
        updateProfileBtn.addEventListener('click', async () => {
            if (!window.currentUserNav) {
                accountSettingsErrorMessage.textContent = 'You must be logged in to update your profile.';
                return;
            }
            const newName = accountDisplayNameInput.value.trim();
            accountSettingsErrorMessage.textContent = '';
            try {
                await window.currentUserNav.updateProfile({ displayName: newName });
                window.showConfirmModal('Profile Updated', 'Your display name has been updated successfully!', () => {
                    if (accountSettingsModal) accountSettingsModal.classList.remove('active');
                }, 'OK', '');
                if (welcomeMessage) { // Update welcome message immediately
                    const displayName = newName || window.currentUserNav.email.split('@')[0];
                    welcomeMessage.textContent = `Welcome, ${displayName}!`;
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                accountSettingsErrorMessage.textContent = getFirebaseErrorMessage(error);
            }
        });
    }

    // Link to Password Reset Modal
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => {
            if (accountSettingsModal) accountSettingsModal.classList.remove('active');
            if (passwordResetModal) {
                passwordResetModal.classList.add('active');
                resetEmailInput.value = window.currentUserNav ? window.currentUserNav.email : '';
                resetErrorMessage.textContent = '';
            }
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.showConfirmModal(
                'Confirm Logout',
                'Are you sure you want to log out?',
                () => {
                    auth.signOut().then(() => {
                        console.log('User signed out successfully.');
                        // localStorage will be cleared by script.js's authStateChanged listener
                        // accountSettingsModal and others will be closed by navbar.js's authStateChanged
                    }).catch((error) => {
                        console.error('Error signing out:', error);
                        window.showConfirmModal('Logout Error', 'Error logging out. Please try again.', () => {}, 'OK', '');
                    });
                },
                'Yes, Logout',
                'Cancel'
            );
        });
    }

    // Handle Forgot Password link
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (authModal) authModal.classList.remove('active');
            if (passwordResetModal) {
                passwordResetModal.classList.add('active');
                resetEmailInput.value = '';
                resetErrorMessage.textContent = '';
                setTimeout(() => resetEmailInput.focus(), 300);
            }
        });
    }

    // Send Password Reset Email Button
    if (sendResetEmailBtn) {
        sendResetEmailBtn.addEventListener('click', async () => {
            const email = resetEmailInput.value.trim();
            resetErrorMessage.textContent = '';
            if (!email) {
                resetErrorMessage.textContent = 'Please enter your email address.';
                return;
            }
            try {
                await auth.sendPasswordResetEmail(email);
                if (passwordResetModal) passwordResetModal.classList.remove('active');
                window.showConfirmModal(
                    'Password Reset Email Sent',
                    `A password reset link has been sent to ${email}. Please check your inbox (and spam folder).`,
                    () => {},
                    'OK',
                    ''
                );
            } catch (error) {
                console.error('Password reset error:', error);
                resetErrorMessage.textContent = getFirebaseErrorMessage(error);
            } finally {
                resetEmailInput.value = '';
            }
        });
    }

    // Close Password Reset Modal Button
    if (closeResetModalBtn) {
        closeResetModalBtn.addEventListener('click', () => {
            if (passwordResetModal) passwordResetModal.classList.remove('active');
        });
        if (passwordResetModal) {
            passwordResetModal.addEventListener('click', (e) => {
                if (e.target === passwordResetModal) {
                    passwordResetModal.classList.remove('active');
                }
            });
        }
    }


    // Optional: Handle Enter key press for forms
    if (loginEmailInput) loginEmailInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') loginPasswordInput.focus(); });
    if (loginPasswordInput) loginPasswordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') loginBtn.click(); });
    if (signupEmailInput) signupEmailInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') signupPasswordInput.focus(); });
    if (signupNameInput) signupNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') signupEmailInput.focus(); });
    if (signupPasswordInput) signupPasswordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') signupConfirmPasswordInput.focus(); });
    if (signupConfirmPasswordInput) signupConfirmPasswordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') signupBtn.click(); });
    if (resetEmailInput) resetEmailInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendResetEmailBtn.click(); });
    if (accountDisplayNameInput) accountDisplayNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') updateProfileBtn.click(); });


    // --- Theme Toggle Logic ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const mobileThemeToggleLinkElem = document.getElementById('mobile-theme-toggle-link');

    function setThemeIcons() {
    const isDark = document.body.classList.contains('dark');
    const isGreen = document.body.classList.contains('green');
    const lightIcon = themeToggleBtn?.querySelector('.light-icon');
    const darkIcon = themeToggleBtn?.querySelector('.dark-icon');
    const greenIcon = themeToggleBtn?.querySelector('.green-icon');

    // Mobile theme toggle icons
    const mobileLightIcon = document.querySelector('.mobile-light-icon');
    const mobileDarkIcon = document.querySelector('.mobile-dark-icon');
    const mobileGreenIcon = document.querySelector('.mobile-green-icon');

    if (lightIcon && darkIcon && greenIcon) {
        // Hide all icons first
        lightIcon.style.display = 'none';
        darkIcon.style.display = 'none';
        greenIcon.style.display = 'none';
        
        // Show the appropriate icon based on current theme
        if (isDark) {
            darkIcon.style.display = 'inline-block';
        } else if (isGreen) {
            greenIcon.style.display = 'inline-block';
        } else {
            lightIcon.style.display = 'inline-block';
        }
    }

    // Update mobile theme toggle icons
    if (mobileLightIcon && mobileDarkIcon && mobileGreenIcon) {
        // Hide all mobile icons first
        mobileLightIcon.style.display = 'none';
        mobileDarkIcon.style.display = 'none';
        mobileGreenIcon.style.display = 'none';
        
        // Show the appropriate mobile icon based on current theme
        if (isDark) {
            mobileDarkIcon.style.display = 'inline-block';
        } else if (isGreen) {
            mobileGreenIcon.style.display = 'inline-block';
        } else {
            mobileLightIcon.style.display = 'inline-block';
        }
    }
}

    // Initial theme setup on load
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const storedTheme = localStorage.getItem('theme');

    // Remove any existing theme classes
    document.body.classList.remove('dark', 'green');

    if (storedTheme === 'dark') {
        document.body.classList.add('dark');
    } else if (storedTheme === 'green') {
        document.body.classList.add('green');
    } else if (storedTheme === 'light' || (!storedTheme && !prefersDark)) {
        // Default to light theme
        document.body.classList.remove('dark', 'green');
    } else if (!storedTheme && prefersDark) {
        // User prefers dark mode and no stored preference
        document.body.classList.add('dark');
    }
    setThemeIcons();

    // If redirected for auth, open modal on pages that include it
    try {
        const shouldOpenAuth = sessionStorage.getItem('openAuthOnLoad') === '1';
        if (shouldOpenAuth && authModal) {
            sessionStorage.removeItem('openAuthOnLoad');
            authModal.classList.add('active');
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
            loginErrorMessage.textContent = '';
            signupErrorMessage.textContent = '';
            if (loginEmailInput) {
                loginEmailInput.value = '';
                loginPasswordInput.value = '';
                setTimeout(() => loginEmailInput.focus(), 300);
            }
        }
    } catch (e) {}

    function toggleTheme() {
        const body = document.body;
        const isDark = body.classList.contains('dark');
        const isGreen = body.classList.contains('green');
        
        // Remove all theme classes first
        body.classList.remove('dark', 'green');
        
        // Cycle through themes: light -> dark -> green -> light
        if (!isDark && !isGreen) {
            // Currently light, switch to dark
            body.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else if (isDark) {
            // Currently dark, switch to green
            body.classList.add('green');
            localStorage.setItem('theme', 'green');
        } else if (isGreen) {
            // Currently green, switch to light (default)
            localStorage.setItem('theme', 'light');
        }
        
        setThemeIcons();
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
    if (mobileThemeToggleLinkElem) {
        mobileThemeToggleLinkElem.addEventListener('click', (e) => {
            e.preventDefault();
            toggleTheme();
            const navLinks = document.querySelector(".nav-links");
            if (navLinks && navLinks.classList.contains('show')) {
                navLinks.classList.remove('show');
            }
        });
    }

    // --- Hamburger Menu Logic ---
    const hamburger = document.getElementById("hamburger");
    const navLinks = document.querySelector(".nav-links");

    if (hamburger && navLinks) {
        console.log("Hamburger menu elements found, adding event listener");
        hamburger.addEventListener("click", () => {
            console.log("Hamburger clicked, toggling nav-links");
            navLinks.classList.toggle("show");
            console.log("Nav-links classes after toggle:", navLinks.className);
        });
    } else {
        console.error("Hamburger menu elements not found:", { hamburger, navLinks });
    }

    // --- Active Navigation Link Highlighting ---
    const currentPage = window.location.pathname.split('/').pop();
    const navLinksList = document.querySelectorAll('.nav-links a');

    navLinksList.forEach(link => {
        const linkHref = link.getAttribute('href');
        // Exclude the mobile theme toggle link from active styling
        if (linkHref === currentPage && link.id !== 'mobile-theme-toggle-link') {
            link.classList.add('active-nav-link');
        }
    });

    // --- Scroll-to-Top Button Logic ---
    const scrollToTopBtn = document.getElementById("scrollToTopBtn");

    if (scrollToTopBtn) {
        window.addEventListener("scroll", () => {
            if (window.scrollY > 300) {
                scrollToTopBtn.classList.add("show");
            } else {
                scrollToTopBtn.classList.remove("show");
            }
        }, { passive: true });

        scrollToTopBtn.addEventListener("click", () => {
            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        });
    }
});

// === Toast Notification System ===
(function() {
    const MAX_TOASTS = 3;
    const TOAST_DURATION = 3500;
    const container = document.getElementById('toast-container');
    if (!container) return;

    function removeToast(toast) {
        toast.classList.add('toast-fadeout');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 500);
    }

    window.showToast = function(message, type = 'info') {
        // Remove oldest if over limit
        while (container.children.length >= MAX_TOASTS) {
            removeToast(container.children[0]);
        }
        // Create toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        // Dismiss on click
        toast.addEventListener('click', () => removeToast(toast));
        // Auto-dismiss
        setTimeout(() => removeToast(toast), TOAST_DURATION);
        container.appendChild(toast);
        // Animate in
        requestAnimationFrame(() => toast.style.opacity = '1');
    };
})();
