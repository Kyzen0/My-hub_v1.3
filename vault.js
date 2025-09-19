// vault.js - Comprehensive Logic for the Vault Page
// Includes: Common UI, List Management, Password Protection, Forgot Password/Reset

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements for Password Logic ---
    const passwordModal = document.getElementById('password-modal');
    const vaultPasswordInput = document.getElementById('vault-password-input');
    const vaultUnlockBtn = document.getElementById('vault-unlock-btn');
    const passwordError = document.getElementById('password-error');
    const vaultContent = document.getElementById('vault-content');
    const closeVaultPasswordModalBtn = document.getElementById('close-vault-password-modal');

    // For "Forgot Password" feature
    // IMPORTANT: Changed IDs to match the updated vault.html (added 'vault-' prefix)
    const forgotVaultPasswordSection = document.getElementById('forgot-password-section-vault');
    const forgotVaultPasswordLink = document.getElementById('forgot-vault-password-link');
    const setNewPasswordModal = document.getElementById('set-new-password-modal');
    const newPasswordInput = document.getElementById('new-password-input');
    const confirmNewPasswordInput = document.getElementById('confirm-new-password-input');
    const setNewPasswordBtn = document.getElementById('set-password-btn');
    const newPasswordErrorMessage = document.getElementById('new-password-error-message');
    const closeSetNewPasswordModalBtn = document.getElementById('close-set-new-password-modal');

    // Password Toggle Icons
    const vaultPasswordToggle = document.getElementById('vault-password-toggle');
    const newPasswordToggle1 = document.getElementById('new-password-toggle-1');
    const newPasswordToggle2 = document.getElementById('new-password-toggle-2');


    // --- Password Configuration ---
    // IMPORTANT: VAULT_PASSWORD will be dynamically loaded from localStorage.
    // Use 'vaultPassword' key consistently.
    let VAULT_PASSWORD = localStorage.getItem('vaultPassword');

    const MAX_FAILED_ATTEMPTS = 4; // Show reset after 4 wrong attempts
    const MIN_PASSWORD_LENGTH = 4; // New: vault password minimum length
    let failedAttempts = 0; // Do not persist attempt count


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
            // Hint browsers/PMs that these are not account credentials
            try {
                inputElement.setAttribute('autocomplete', 'new-password');
                inputElement.setAttribute('data-lpignore', 'true');
                inputElement.setAttribute('data-1p-ignore', 'true');
                inputElement.setAttribute('autocapitalize', 'off');
                inputElement.setAttribute('autocorrect', 'off');
                inputElement.setAttribute('spellcheck', 'false');
            } catch (e) {}
        }
    }

    // Apply password toggle to all relevant inputs
    setupPasswordToggle(vaultPasswordInput, vaultPasswordToggle);
    setupPasswordToggle(newPasswordInput, newPasswordToggle1);
    setupPasswordToggle(confirmNewPasswordInput, newPasswordToggle2);


    // --- Vault Access State Management ---

    // Function to update the visibility of "Forgot Password" link based on failed attempts
    function updateForgotPasswordVisibility() {
        if (forgotVaultPasswordSection) { // Use the updated ID
            // Show link only if a password is set and failed attempts exceed limit
            if (VAULT_PASSWORD && failedAttempts >= MAX_FAILED_ATTEMPTS) {
                forgotVaultPasswordSection.style.display = 'block'; // Ensure it's block to break line
            } else {
                forgotVaultPasswordSection.style.display = 'none';
            }
        }
    }

    // Main function to control which vault screen is visible (login, set new password, or content)
    function initializeVaultDisplay() {
        // Reload VAULT_PASSWORD to ensure it's current (especially after a reset)
        VAULT_PASSWORD = localStorage.getItem('vaultPassword'); 
        const isVaultUnlockedSession = sessionStorage.getItem('vaultUnlocked') === 'true';

        if (!VAULT_PASSWORD) {
            // Scenario 1: No password set (first time user or after reset)
            passwordModal.classList.remove('active'); // Hide main password modal
            setNewPasswordModal.classList.add('active'); // Show set new password modal
            vaultContent.style.display = 'none'; // Ensure content is hidden

            newPasswordInput.value = '';
            confirmNewPasswordInput.value = '';
            newPasswordErrorMessage.textContent = '';
            setTimeout(() => newPasswordInput.focus(), 350); // Focus after modal transition
        } else {
            // Scenario 3: Password needs to be entered (first visit in session or after logout/tab close)
            passwordModal.classList.add('active'); // Show password modal
            setNewPasswordModal.classList.remove('active');
            vaultContent.style.display = 'none'; // Ensure content is hidden

            passwordError.textContent = ''; // Clear any previous error message
            vaultPasswordInput.value = ''; // Clear password input field
            passwordError.classList.remove('show'); // Ensure error message is hidden initially
            updateForgotPasswordVisibility(); // Check and show/hide forgot password link
            
            // Focus on password input after a slight delay to allow modal transition
            setTimeout(() => {
                if (vaultPasswordInput) vaultPasswordInput.focus();
            }, 350);
        }
    }

    // --- Close buttons: redirect away if user doesn't want to unlock now ---
    function goBackOrHome() {
        if (document.referrer && document.referrer !== window.location.href) {
            window.history.back();
        } else {
            window.location.href = 'index.html';
        }
    }
    if (closeVaultPasswordModalBtn) {
        closeVaultPasswordModalBtn.addEventListener('click', () => {
            goBackOrHome();
        });
    }
    if (closeSetNewPasswordModalBtn) {
        closeSetNewPasswordModalBtn.addEventListener('click', () => {
            goBackOrHome();
        });
    }

    // --- Unlock Vault Logic ---
    function unlockVault() {
        const enteredPassword = vaultPasswordInput.value;

        if (enteredPassword === VAULT_PASSWORD) {
            passwordModal.classList.remove('active'); // Hide modal with CSS transition
            // Wait for transition to complete before changing display property
            setTimeout(() => {
                vaultContent.style.display = 'block'; // Show content
                // Do NOT persist unlocked state; require re-entry on navigation/back
                failedAttempts = 0; // Reset failed attempts (not persisted)
                // Render lists now that content is visible
                if (typeof renderGenericListUI === 'function') {
                    renderGenericListUI('accounts', getListFromLocalStorage('accounts'));
                    renderGenericListUI('notes', getListFromLocalStorage('notes'));
                }
                // Removed modal on successful unlock to avoid interrupting user flow
            }, 300); // Duration matches CSS transition for .modal-overlay

            passwordError.classList.remove('show'); // Hide error message
            passwordError.textContent = ''; // Clear error message text
            vaultPasswordInput.value = ''; // Clear password input field
            vaultPasswordInput.classList.remove('input-error'); // Ensure error styling is removed on success
        } else {
            failedAttempts++;
            // Do not persist attempts; show generic error without counters
            passwordError.textContent = `Incorrect password.`;
            passwordError.classList.add('show'); // Show error message

            // Visual feedback: Add 'input-error' class to shake and change border color
            vaultPasswordInput.classList.add('input-error');

            // Clear input and refocus for next attempt
            vaultPasswordInput.value = '';
            vaultPasswordInput.focus();

            // Remove 'input-error' class after a short delay (e.g., 1.5 seconds)
            setTimeout(() => {
                vaultPasswordInput.classList.remove('input-error');
            }, 1500); // Matches the duration of the shake animation

            updateForgotPasswordVisibility(); // Update forgot password link visibility

            // Custom alert on too many failed attempts
            if (failedAttempts === MAX_FAILED_ATTEMPTS && typeof window.showConfirmModal === 'function') {
                window.showConfirmModal(
                    'Too Many Attempts',
                    'You have entered the wrong password too many times. Use "Forgot Vault Password?" to reset your vault.',
                    () => {},
                    'OK',
                    ''
                );
            }
        }
    }

    // Enable/disable Unlock button based on input length matching stored password length
    function updateUnlockButtonState() {
        const enteredLength = (vaultPasswordInput?.value || '').length;
        const requiredLength = (VAULT_PASSWORD || '').length;
        if (!vaultUnlockBtn || !vaultPasswordInput) return;
        // Disable if no password is set yet, or entered length is shorter than required
        const shouldEnable = requiredLength > 0 && enteredLength >= requiredLength;
        vaultUnlockBtn.disabled = !shouldEnable;
        vaultUnlockBtn.classList.toggle('disabled', !shouldEnable);
    }

    if (vaultPasswordInput) {
        vaultPasswordInput.addEventListener('input', updateUnlockButtonState);
    }

    if (vaultUnlockBtn) {
        vaultUnlockBtn.addEventListener('click', unlockVault);
        // Initialize disabled state on load
        updateUnlockButtonState();
    }

    // Event listener for Enter key press in password input field
    if (vaultPasswordInput) {
        vaultPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent default form submission if any
                unlockVault(); // Trigger unlock logic
            }
        });
    }


    // --- "Forgot Vault Password" Logic ---
    if (forgotVaultPasswordLink) { // Use the updated ID
        forgotVaultPasswordLink.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
            // IMPORTANT: Now using window.showConfirmModal from script.js
            window.showConfirmModal(
                'Reset Vault and Data',
                'This will permanently delete ALL your vault notes and links and require you to set a new password. This action cannot be undone. Are you sure you want to proceed?',
                () => {
                    localStorage.removeItem('notesList');
                    localStorage.removeItem('notesLastUpdated');
                    localStorage.removeItem('accountsList');
                    localStorage.removeItem('accountsLastUpdated');
                    localStorage.removeItem('vaultPassword');
                    sessionStorage.removeItem('vaultUnlocked');

                    VAULT_PASSWORD = null;
                    failedAttempts = 0;

                    passwordModal.classList.remove('active');
                    setTimeout(() => { initializeVaultDisplay(); }, 300);

                    if (typeof window.showConfirmModal === 'function') {
                        window.showConfirmModal('Vault Reset', 'Your vault has been reset. Please set a new password to continue.', () => {}, 'OK', '');
                    }
                },
                'Yes, Delete & Reset',
                'No, Go Back'
            );
        });
    }


    // --- Set New Password Modal Logic ---
    if (setNewPasswordBtn) {
        setNewPasswordBtn.addEventListener('click', () => {
            const newPass = newPasswordInput.value.trim();
            const confirmPass = confirmNewPasswordInput.value.trim();

            if (!newPass || !confirmPass) {
                newPasswordErrorMessage.textContent = 'Please fill in both password fields.';
                if (!newPass) newPasswordInput.classList.add('input-error');
                if (!confirmPass) confirmNewPasswordInput.classList.add('input-error');
                setTimeout(() => { 
                    newPasswordInput.classList.remove('input-error');
                    confirmNewPasswordInput.classList.remove('input-error');
                }, 1500);
                return;
            }
            if (newPass.length < MIN_PASSWORD_LENGTH) { // Updated minimum length
                newPasswordErrorMessage.textContent = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
                newPasswordInput.classList.add('input-error');
                setTimeout(() => { newPasswordInput.classList.remove('input-error'); }, 1500);
                return;
            }
            if (confirmPass.length < MIN_PASSWORD_LENGTH) {
                newPasswordErrorMessage.textContent = `Confirm password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
                confirmNewPasswordInput.classList.add('input-error');
                setTimeout(() => { confirmNewPasswordInput.classList.remove('input-error'); }, 1500);
                return;
            }
            if (newPass !== confirmPass) {
                newPasswordErrorMessage.textContent = 'Passwords do not match.';
                newPasswordInput.classList.add('input-error');
                confirmNewPasswordInput.classList.add('input-error');
                setTimeout(() => { 
                    newPasswordInput.classList.remove('input-error');
                    confirmNewPasswordInput.classList.remove('input-error');
                }, 1500);
                return;
            }

            VAULT_PASSWORD = newPass; // Update global variable
            localStorage.setItem('vaultPassword', newPass); // Save to localStorage

            setNewPasswordModal.classList.remove('active'); // Hide modal
            setTimeout(() => {
                // Show vault content immediately; no session persistence
                vaultContent.style.display = 'block';
                if (typeof renderGenericListUI === 'function') {
                    renderGenericListUI('accounts', getListFromLocalStorage('accounts'));
                    renderGenericListUI('notes', getListFromLocalStorage('notes'));
                }
            }, 300); // Allow modal transition to finish

            // Clear inputs after successful set
            newPasswordInput.value = '';
            confirmNewPasswordInput.value = '';

            // Custom alert for successful password set
            if (typeof window.showConfirmModal === 'function') {
                window.showConfirmModal('Vault Password Set', 'Your vault has been secured and unlocked for this session.', () => {}, 'OK', '');
            }
        });
    }

    // Add cancel button logic for set new password modal
    const cancelSetPasswordBtn = document.getElementById('cancel-set-password-btn'); // Needs to be declared
    if (cancelSetPasswordBtn) {
        cancelSetPasswordBtn.addEventListener('click', () => {
            setNewPasswordModal.classList.remove('active');
            // If they cancel setting a password, the vault remains hidden and inaccessible until next visit/refresh.
        });
    }

    // Event listeners for Enter key in new password fields
    if (newPasswordInput) {
        newPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmNewPasswordInput.focus();
            }
        });
    }
    if (confirmNewPasswordInput) {
        confirmNewPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                setNewPasswordBtn.click();
            }
        });
    }



    // Remove duplicated list logic; vault lists are now handled by script.js


    function setLastUpdatedDisplay(type) {
        const listElement = document.querySelector(`#${type}-list`);
        if (!listElement) return;

        const lastUpdatedDiv = listElement.closest('.card').querySelector('.card-footer .last-updated');
        if (lastUpdatedDiv) {
            lastUpdatedDiv.textContent = `Last updated: ${getListLastUpdated(type)}`;
        }
    }

    function createGenericItemElement(type, name) {
        const li = document.createElement('li');
        li.setAttribute('draggable', 'true');
        li.dataset.itemName = name;

        const itemTextSpan = document.createElement('span');
        itemTextSpan.className = 'item-text';
        itemTextSpan.textContent = name;
        li.appendChild(itemTextSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-actions';

        const editBtn = document.createElement('span');
        editBtn.textContent = 'Edit';
        editBtn.className = 'action-btn';
        editBtn.onclick = (event) => {
            event.stopPropagation();
            editGenericItem(li, name, type);
        };
        actionsDiv.appendChild(editBtn);

        const deleteBtn = document.createElement('span');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'action-btn';
        deleteBtn.onclick = (event) => {
            event.stopPropagation();
            window.showConfirmModal( // Now explicitly calling window.showConfirmModal
                `Delete Item`,
                `Are you sure you want to delete "${name}"?`,
                () => {
                    let list = getList(type);
                    list = list.filter(item => item !== name);
                    saveList(type, list);
                    renderGenericList(type);
                },
                'Delete',
                'Cancel'
            );
        };
        actionsDiv.appendChild(deleteBtn);

        li.appendChild(actionsDiv);

        li.addEventListener('dragstart', (e) => {
            draggedItem = { element: li, data: name, type: type };
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', name);
            li.classList.add('dragging');
        });

        li.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (draggedItem && draggedItem.type === type && draggedItem.element !== li) {
                li.classList.add('drag-over');
            }
        });

        li.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        li.addEventListener('dragleave', () => {
            li.classList.remove('drag-over');
        });

        li.addEventListener('drop', (e) => {
            e.preventDefault();
            li.classList.remove('drag-over');

            if (draggedItem && draggedItem.type === type && draggedItem.element !== li) {
                const currentList = getList(type);
                const draggedData = draggedItem.data;
                const dropTargetData = li.dataset.itemName;

                const draggedIndex = currentList.indexOf(draggedData);
                const dropTargetIndex = currentList.indexOf(dropTargetData);

                if (draggedIndex > -1 && dropTargetIndex > -1) {
                    const [removed] = currentList.splice(draggedIndex, 1);
                    currentList.splice(dropTargetIndex, 0, removed);
                    saveList(type, currentList);
                    renderGenericList(type);
                }
            }
        });

        li.addEventListener('dragend', () => {
            draggedItem = null;
            const draggingElements = document.querySelectorAll('.dragging');
            draggingElements.forEach(el => el.classList.remove('dragging'));
            const dragOverElements = document.querySelectorAll('.drag-over');
            dragOverElements.forEach(el => el.classList.remove('drag-over'));
        });

        return li;
    }

    // Remove local render function; use global from script.js

    // Use global addItem/clearList from script.js

    // Removed; handled by script.js

    function editGenericItem(li, oldName, type) {
        li.innerHTML = '';
        li.classList.add('editing-item');
        li.removeAttribute('draggable');

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = oldName;
        nameInput.className = 'edit-input';
        nameInput.focus();

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.onclick = () => {
            const newName = nameInput.value.trim();
            if (!newName) {
                nameInput.classList.add('input-error');
                setTimeout(() => { nameInput.classList.remove('input-error'); }, 1500);
                return;
            }

            let list = getList(type);
            const isDuplicate = list.some(item => item === newName && item !== oldName);

            if (isDuplicate) {
                window.showConfirmModal('Duplicate Entry', 'An item with this name already exists!', () => {}, '', 'Dismiss');
                nameInput.classList.add('input-error');
                setTimeout(() => { nameInput.classList.remove('input-error'); }, 1500);
                return;
            }

            list = list.map(item => item === oldName ? newName : item);
            saveList(type, list);
            li.classList.remove('editing-item');
            renderGenericList(type);
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            li.classList.remove('editing-item');
            renderGenericList(type);
        };

        li.appendChild(nameInput);
        const editActionsDiv = document.createElement('div');
        editActionsDiv.className = 'item-actions';
        editActionsDiv.appendChild(saveBtn);
        editActionsDiv.appendChild(cancelBtn);
        li.appendChild(editActionsDiv);
    }

    // Removed local toggleView override to use unified implementation from script.js


    // --- Initial setup on page load ---
    initializeVaultDisplay(); // Call this once when the DOM is ready

    // This ensures JS re-executes or re-checks the state when returning to the page from cache (browser back/forward)
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) { // persisted indicates if the page was loaded from cache
            console.log('Page loaded from cache (persisted). Re-initializing vault display.');
            initializeVaultDisplay();
        }
    });

}); // End DOMContentLoaded
