// script.js - Core List Management Logic for My Hub (Firestore Integration with Optimistic Write-Through Cache)

document.addEventListener('DOMContentLoaded', () => {
    // Firebase 'auth' and 'db' objects are expected to be globally available
    // from the Firebase SDKs initialized in the HTML file.
    // window.currentUserNav will be set by navbar.js's auth state listener.

    // This script now focuses purely on list data management.
    // Authentication modals and general UI are handled by navbar.js

    // --- PWA and Offline Support ---
    // Global import guard to avoid snapshot overwrites during import merge
    window.isImportingData = false;
    window.lastImportAt = 0;
    let isOnline = navigator.onLine;
    let pendingSync = []; // Store offline changes for later sync
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
        isOnline = true;
        console.log('[script.js] App is now online');
        syncPendingChanges();
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        console.log('[script.js] App is now offline');
    });
    
    // Sync pending changes when coming back online
    function syncPendingChanges() {
        if (pendingSync.length > 0 && currentUser) {
            console.log('[script.js] Syncing', pendingSync.length, 'pending changes');
            pendingSync.forEach(change => {
                // Re-attempt the Firestore operation
                if (change.type === 'add') {
                    addItemToFirestore(change.listType, change.data);
                } else if (change.type === 'update') {
                    updateItemInFirestore(change.listType, change.id, change.data);
                } else if (change.type === 'delete') {
                    deleteItemFromFirestore(change.listType, change.id);
                }
            });
            pendingSync = []; // Clear pending changes
        }
    }

    // --- Offline Authentication Persistence ---
    // Store user info in localStorage for offline access
    function saveUserToLocalStorage(user) {
        if (user) {
            try {
                localStorage.setItem('offlineUser', JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.warn('Could not save user to localStorage:', e);
            }
        }
    }

    function getOfflineUser() {
        try {
            const userData = localStorage.getItem('offlineUser');
            if (userData) {
                const user = JSON.parse(userData);
                // Check if the stored user data is not too old (24 hours)
                if (Date.now() - user.timestamp < 24 * 60 * 60 * 1000) {
                    return user;
                }
            }
        } catch (e) {
            console.warn('Could not get offline user:', e);
        }
        return null;
    }

    function clearOfflineUser() {
        try {
            localStorage.removeItem('offlineUser');
        } catch (e) {
            console.warn('Could not clear offline user:', e);
        }
    }

    // --- Firebase User State Management ---
    // This script will react to changes in window.currentUserNav, set by navbar.js
    let currentUser = null; // Local copy of user for data operations
    let firestoreUnsubscribe = {}; // To store Firestore real-time listeners for each list

    // Firestore Utility Function: Get collection reference for current user
    const getUserCollectionRef = (collectionName) => {
        // Use window.currentUserNav as the source of truth for current user
        if (!currentUser || !currentUser.uid) {
            return null;
        }
        // Firestore data structure: users/{uid}/{collectionName}/{documents}
        return db.collection('users').doc(currentUser.uid).collection(collectionName);
    };

    // Listen for authentication state changes (primarily for data synchronization)
    auth.onAuthStateChanged(user => {
        currentUser = user; // Update local currentUser variable for this script
        console.log('[script.js] Auth state changed. User:', user ? user.uid : 'null');

        // Store user for offline access
        if (user) {
            saveUserToLocalStorage(user);
        } else {
            clearOfflineUser();
        }

        // Clear existing Firestore listeners to prevent data mix-ups on user change/logout
        for (const type in firestoreUnsubscribe) {
            if (firestoreUnsubscribe[type]) {
                firestoreUnsubscribe[type](); // Call the unsubscribe function
                firestoreUnsubscribe[type] = null;
                console.log(`[script.js] Unsubscribed existing listener for ${type}.`);
            }
        }

        if (user) {
            console.log('[script.js] User logged in for data sync:', user.email, 'UID:', user.uid);
            // Initialize lists and start Firestore sync if user is logged in
            initializePageLists(true);
        } else {
            console.log('[script.js] User logged out for data sync.');
            // Clear ALL app-related localStorage and session flags on logout, including vault
            try {
                const keysToRemove = [
                    'watchingList','watchingLastUpdated',
                    'completedList','completedLastUpdated',
                    'projectsList','projectsLastUpdated',
                    'upcomingList','upcomingLastUpdated',
                    'bookmarks_tools','bookmarks_tools_lastUpdated',
                    'bookmarks_entertainment','bookmarks_entertainment_lastUpdated',
                    'accountsList','accountsLastUpdated',
                    'notesList','notesLastUpdated',
                    'vaultPassword','vaultFailedAttempts'
                ];
                keysToRemove.forEach(k => localStorage.removeItem(k));
                sessionStorage.removeItem('vaultUnlocked');
            } catch (e) {
                console.warn('Error clearing local/session storage on logout:', e);
            }

            // Initialize lists from Local Storage for the logged-out state (now empty)
            initializePageLists(false);
        }
    });

    // Check for offline user on page load
    if (!isOnline) {
        const offlineUser = getOfflineUser();
        if (offlineUser && !currentUser) {
            console.log('[script.js] Using offline user data:', offlineUser.email);
            // Set the offline user for data operations
            currentUser = offlineUser;
            // Update the global user variable for navbar.js
            window.currentUserNav = offlineUser;
            // Initialize lists with offline user
            initializePageLists(false); // false = offline mode
        }
    }


    // --- Common List Management Logic ---
    const maxVisible = 5;
    const expanded = {};
    let draggedItem = null;

    function getCurrentTimestamp() {
        const now = new Date();
        const options = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
        return new Intl.DateTimeFormat('en-US', options).format(now);
    }

    // --- LOCAL STORAGE HELPER FUNCTIONS ---
    function getListFromLocalStorage(type) {
        const stored = localStorage.getItem(`${type}List`);
        try {
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error(`Error parsing localStorage for ${type}List:`, e);
            return [];
        }
    }

    function saveListToLocalStorage(type, list) {
        localStorage.setItem(`${type}List`, JSON.stringify(list));
        localStorage.setItem(`${type}LastUpdated`, getCurrentTimestamp());
    }

    function getBookmarkListFromLocalStorage(storageKey) {
        const stored = localStorage.getItem(storageKey);
        try {
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error(`Error parsing localStorage for ${storageKey}:`, e);
            return [];
        }
    }

    function saveBookmarkListToLocalStorage(storageKey, list) {
        localStorage.setItem(storageKey, JSON.stringify(list));
        localStorage.setItem(`${storageKey}_lastUpdated`, getCurrentTimestamp());
    }
    // --- END LOCAL STORAGE HELPER FUNCTIONS ---


    // Unified function to set last updated display for both generic lists and bookmarks
    function setLastUpdatedDisplay(typeOrListId, storageKey = null) {
        let lastUpdatedDiv;
        let lastUpdatedTimestamp;

        if (storageKey) { // It's a bookmark list, listId is like 'tools-list'
            lastUpdatedDiv = document.querySelector(`#${typeOrListId}`)?.closest('.card')?.querySelector('.card-footer .last-updated');
            lastUpdatedTimestamp = localStorage.getItem(`${storageKey}_lastUpdated`) || 'Never';
        } else { // It's a generic list, typeOrListId is like 'watching'
            lastUpdatedDiv = document.querySelector(`#${typeOrListId}-list`)?.closest('.card')?.querySelector('.card-footer .last-updated');
            lastUpdatedTimestamp = localStorage.getItem(`${typeOrListId}LastUpdated`) || 'Never';
        }
        
        // If logged in, we indicate that it's cloud-synced, as timestamp can be misleading due to real-time updates
        if (currentUser && lastUpdatedDiv) {
            lastUpdatedDiv.textContent = `Last updated: Cloud Sync`;
        } else if (lastUpdatedDiv) {
            lastUpdatedDiv.textContent = `Last updated: ${lastUpdatedTimestamp}`;
        }
    }

    // Helper to check if user is verified for cloud operations
    function isUserVerifiedForCloudOps() {
        if (!currentUser) {
            // Check if we're offline and have offline user data
            if (!navigator.onLine) {
                const offlineUser = getOfflineUser();
                if (offlineUser) {
                    // User is offline but has cached login - allow local operations
                    return true;
                }
            }
            // Use global showConfirmModal (defined in navbar.js)
            window.showConfirmModal('Login Required', 'Please log in to save and sync your data with the cloud.', () => {}, 'OK', '');
            return false;
        }
        if (!currentUser.emailVerified) {
            window.showConfirmModal(
                'Email Verification Required',
                'Your email address is not verified. Please verify your email to enable cloud saving and synchronization.',
                () => {},
                'OK',
                ''
            );
            return false;
        }
        return true;
    }


    // --- Firestore & LocalStorage Integration Functions ---
    // Lightweight top loader controls
    const topLoader = document.getElementById('top-loader');
    function startTopLoader() {
        if (topLoader) topLoader.classList.add('active');
    }
    function finishTopLoader() {
        if (!topLoader) return;
        // Fill to 100% briefly, then hide
        const bar = topLoader.querySelector('.bar');
        if (bar) bar.style.width = '100%';
        setTimeout(() => {
            topLoader.classList.remove('active');
            if (bar) bar.style.width = '';
        }, 220);
    }

    // Generic Lists (Anime, Projects)
    async function syncGenericListFromFirestore(type) {
        startTopLoader();
        const collectionName = type;
        const collectionRef = getUserCollectionRef(collectionName);
        console.log(`[syncGenericListFromFirestore] Attempting to sync ${collectionName}. currentUser:`, currentUser ? currentUser.uid : 'null', 'collectionRef:', collectionRef);

        // Remove existing listener if any
        if (firestoreUnsubscribe[collectionName]) {
            firestoreUnsubscribe[collectionName]();
            firestoreUnsubscribe[collectionName] = null;
            console.log(`[syncGenericListFromFirestore] Unsubscribed existing listener for ${collectionName}.`);
        }
        
        // If no user or user is not verified, we don't set up the Firestore listener for writes.
        // Reads are allowed by security rules, but we'll only sync if user is verified for full functionality.
        if (!collectionRef || !currentUser || !currentUser.emailVerified) {
             console.warn(`[syncGenericListFromFirestore] Skipping Firestore sync for ${collectionName}: No collectionRef, or user not logged in/verified.`);
            // Local storage data should already be rendered by initializePageLists
            return;
        }

        // Show loading indicator only if localStorage is empty and we're expecting cloud data
        const localData = getListFromLocalStorage(type);
        if (localData.length === 0) { // Only show loading if currently empty and expecting cloud data
            const ulElement = document.getElementById(`${type}-list`);
            if (ulElement) {
                ulElement.innerHTML = `<li class="empty-message">Loading...</li>`;
                console.log(`[syncGenericListFromFirestore] Showing loading for ${collectionName}.`);
            }
        }

        // Set up Firestore listener
        firestoreUnsubscribe[collectionName] = collectionRef.orderBy('timestamp').onSnapshot(snapshot => {
            if (window.isImportingData) { return; }
            console.log(`[onSnapshot] Received snapshot for ${collectionName}. Docs:`, snapshot.docs.length);
            try {
                // Suppress early snapshot that would wipe freshly-imported local data
                const localLen = getListFromLocalStorage(type).length;
                if (window.lastImportAt && (Date.now() - window.lastImportAt) < 15000 && snapshot.docs.length < localLen) {
                    console.log(`[onSnapshot] Skipping early snapshot for ${collectionName} (server ${snapshot.docs.length} < local ${localLen}).`);
                    finishTopLoader();
                    return;
                }
            } catch (e) {}
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            saveListToLocalStorage(type, items); // Save the received data to localStorage to keep it up-to-date
            renderGenericListUI(type, items); // Render with the cloud data
            console.log(`[onSnapshot] Rendered ${items.length} items for ${collectionName}.`);
            finishTopLoader();
        }, error => {
            console.error("Error listening to Firestore collection:", collectionName, error);
            // Check if we're offline and show appropriate message
            if (!navigator.onLine) {
                console.log(`[syncGenericListFromFirestore] Offline mode - using local data for ${type}`);
                // Don't show error modal when offline - just use local data silently
            } else {
                window.showConfirmModal('Connection Error', `Could not load ${type} from cloud. Displaying local data.`, () => {}, 'OK', '');
            }
            // On error, revert to local storage data
            renderGenericListUI(type, getListFromLocalStorage(type));
            finishTopLoader();
        });
    }

    async function addItemUnified(type, itemData, inputElement = null) {
        // --- Local Storage (Optimistic & Fallback) ---
        let currentLocalList = getListFromLocalStorage(type);
        let allLocalAnime = (type === 'watching' || type === 'completed') ? getListFromLocalStorage('watching').concat(getListFromLocalStorage('completed')) : [];

        const isDuplicateLocal = (type === 'watching' || type === 'completed')
            ? allLocalAnime.some(item => (typeof item === 'string' ? item : item.name) === (typeof itemData === 'string' ? itemData : itemData.name))
            : currentLocalList.some(item => (typeof item === 'string' ? item : item.name) === (typeof itemData === 'string' ? itemData : itemData.name));

        if (isDuplicateLocal) {
            window.showConfirmModal('Duplicate Entry', 'This item already exists in your list!', () => {}, '', 'Dismiss');
            if (inputElement) {
                inputElement.classList.add('input-error');
                setTimeout(() => { inputElement.classList.remove('input-error'); }, 1500);
            }
            return; // Prevent adding duplicate locally
        }

        // Optimistic UI: Update local storage and render immediately
        currentLocalList.push(itemData);
        saveListToLocalStorage(type, currentLocalList);
        renderGenericListUI(type, currentLocalList); // Render with local data instantly

        if (type === 'watching' || type === 'completed') {
            // Re-render the other anime list to reflect potential changes if it was a move not a new add
            renderGenericListUI(type === 'watching' ? 'completed' : 'watching', getListFromLocalStorage(type === 'watching' ? 'completed' : 'watching'));
        }

        // Clear input immediately after local update
        if (inputElement) {
            inputElement.value = '';
            inputElement.focus();
        }

        // --- Firestore (Asynchronous Sync) ---
        if (isUserVerifiedForCloudOps()) { // ONLY attempt Firestore if user is verified
            const collectionRef = getUserCollectionRef(type);
            if (!collectionRef) { // Should not happen if isUserVerifiedForCloudOps is true, but safety check
                console.warn("User verified but collectionRef missing for Firestore add. This is unexpected.");
                window.showConfirmModal('Error', 'Failed to prepare cloud operation. Please try again.', () => {}, 'OK', '');
                return;
            }
            try {
                // Check for duplicates in Firestore (server-side check if client-side missed, or for other devices)
                const nameToCheck = typeof itemData === 'string' ? itemData : itemData.name;
                const existingQuery = await collectionRef.where('name', '==', nameToCheck).limit(1).get();
                if (!existingQuery.empty) {
                    console.warn("Duplicate detected on Firestore server, reverting local optimistic change.");
                    window.showConfirmModal('Duplicate Entry', 'This item already exists in your cloud list! Local change reverted.', () => {}, '', 'Dismiss');
                    // Firestore onSnapshot will automatically revert the UI to the actual cloud state.
                    return;
                }
                // Ensure item shape always has a name string; for anime we also include completed
                const payload = typeof itemData === 'string' ? { name: itemData } : { ...itemData };
                await collectionRef.add({ ...payload, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
            } catch (error) {
                console.error("Error adding item to Firestore:", error);
                const failedName = typeof itemData === 'string' ? itemData : itemData.name;
                // Check if we're offline and show appropriate message
                if (!navigator.onLine) {
                    console.log(`[addItemToFirestore] Offline mode - item "${failedName}" saved locally, will sync when online`);
                    // Don't show error modal when offline - just log it
                } else {
                    window.showConfirmModal('Connection Error', `Failed to add "${failedName}" to cloud. Local change will persist temporarily.`, () => {}, 'OK', '');
                }
                // onSnapshot will handle potential UI reversion if Firestore eventually fails
            }
        } else {
            // User not verified, changes only apply locally.
            console.log("Add operation not sent to cloud: User not verified.");
        }
    }

    async function updateItemUnified(type, oldItemData, newItemData, nameInput = null) {
        const oldName = typeof oldItemData === 'string' ? oldItemData : oldItemData.name;
        const itemId = oldItemData.id; // Firestore ID
        
        // --- Local Storage (Optimistic) ---
        let currentLocalList = getListFromLocalStorage(type);
        const newName = newItemData.name;

        // Client-side duplicate check (for local storage)
        const isDuplicateLocal = currentLocalList.some(item => {
            const itemName = typeof item === 'string' ? item : item.name;
            return itemName === newName && itemName !== oldName;
        });

        if (isDuplicateLocal) {
            window.showConfirmModal('Duplicate Entry', 'An item with this name already exists locally!', () => {}, '', 'Dismiss');
            if (nameInput) {
                nameInput.classList.add('input-error');
                setTimeout(() => { nameInput.classList.remove('input-error'); }, 1500);
            }
            // No optimistic update, immediately re-render original state if needed
            renderGenericListUI(type, getListFromLocalStorage(type));
            return;
        }

        // Optimistic UI: Update local storage and render
        currentLocalList = currentLocalList.map(item => {
            const currentItemName = typeof item === 'string' ? item : item.name;
            if (currentUser && item.id === itemId) { // If Firestore item, match by ID
                return { ...item, ...newItemData };
            } else if (!currentUser && currentItemName === oldName) { // If LocalStorage item (by name)
                return typeof item === 'string' ? newName : { ...item, ...newItemData };
            }
            return item;
        });
        saveListToLocalStorage(type, currentLocalList);
        renderGenericListUI(type, currentLocalList); // Render instantly

        // --- Firestore (Asynchronous Sync) ---
        if (isUserVerifiedForCloudOps()) { // ONLY attempt Firestore if user is verified
            const docRef = getUserCollectionRef(type)?.doc(itemId);
            if (!docRef) {
                console.warn("User verified but docRef missing for Firestore update. This is unexpected.");
                window.showConfirmModal('Error', 'Failed to prepare cloud operation. Please try again.', () => {}, 'OK', '');
                return;
            }
            try {
                // Server-side duplicate check (if client-side missed or for other devices)
                const collectionRef = getUserCollectionRef(type);
                const existingQuery = await collectionRef.where('name', '==', newName).limit(1).get();
                if (!existingQuery.empty && existingQuery.docs[0].id !== itemId) {
                    console.warn("Duplicate detected on Firestore server during update, reverting local optimistic change.");
                    window.showConfirmModal('Duplicate Entry', 'An item with this name already exists in your cloud list! Local change reverted.', () => {}, '', 'Dismiss');
                    // Firestore onSnapshot will automatically revert the UI to the actual cloud state.
                    return;
                }
                await docRef.update(newItemData);
            } catch (error) {
                console.error("Error updating item in Firestore:", error);
                window.showConfirmModal('Error', `Failed to update "${oldName}" in cloud. Local change will persist temporarily.`, () => {}, 'OK', '');
                // onSnapshot will handle potential UI reversion
            }
        } else {
            // User not verified, changes only apply locally.
            console.log("Update operation not sent to cloud: User not verified.");
        }
    }

    async function deleteItemUnified(type, itemToDeleteData, name) {
        const itemId = itemToDeleteData.id;
        
        // --- Local Storage (Optimistic) ---
        let currentLocalList = getListFromLocalStorage(type);
        currentLocalList = currentLocalList.filter(item => {
            if (currentUser) { // If logged in, prefer to match by Firestore ID
                return item.id !== itemId;
            } else { // If not logged in, match by name
                return (typeof item === 'string' ? item !== name : item.name !== name);
            }
        });
        saveListToLocalStorage(type, currentLocalList);
        renderGenericListUI(type, currentLocalList); // Render instantly

        if (type === 'watching' || type === 'completed') {
            // Re-render the other anime list to reflect immediate change
            renderGenericListUI(type === 'watching' ? 'completed' : 'watching', getListFromLocalStorage(type === 'watching' ? 'completed' : 'watching'));
        }


        // --- Firestore (Asynchronous Sync) ---
        if (isUserVerifiedForCloudOps()) { // ONLY attempt Firestore if user is verified
            const docRef = getUserCollectionRef(type)?.doc(itemId);
            if (!docRef) {
                console.warn("User verified but docRef missing for Firestore delete. This is unexpected.");
                window.showConfirmModal('Error', 'Failed to prepare cloud operation. Please try again.', () => {}, 'OK', '');
                return;
            }
            try {
                await docRef.delete();
            } catch (error) {
                console.error("Error deleting item from Firestore:", error);
                window.showConfirmModal('Error', `Failed to delete "${name}" from cloud. Local change will persist temporarily.`, () => {}, 'OK', '');
                // onSnapshot will handle potential UI reversion
            }
        } else {
            // User not verified, changes only apply locally.
            console.log("Delete operation not sent to cloud: User not verified.");
        }
    }

    async function clearListUnified(type) {
        // --- Local Storage (Optimistic) ---
        saveListToLocalStorage(type, []);
        renderGenericListUI(type, []); // Render instantly

        if (type === 'watching' || type === 'completed') {
            renderGenericListUI(type === 'watching' ? 'completed' : 'watching', getListFromLocalStorage(type === 'watching' ? 'completed' : 'watching'));
        }

        // --- Firestore (Asynchronous Sync) ---
        if (isUserVerifiedForCloudOps()) { // ONLY attempt Firestore if user is verified
            const collectionRef = getUserCollectionRef(type);
            if (!collectionRef) {
                console.warn("User verified but collectionRef missing for Firestore clear. This is unexpected.");
                window.showConfirmModal('Error', 'Failed to prepare cloud operation. Please try again.', () => {}, 'OK', '');
                return;
            }
            try {
                const snapshot = await collectionRef.get();
                if (snapshot.empty) return;

                const batch = db.batch();
                snapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            } catch (error) {
                console.error("Error clearing collection in Firestore:", error);
                window.showConfirmModal('Error', 'Failed to clear cloud list. Local change will persist temporarily.', () => {}, 'OK', '');
            }
        } else {
            // User not verified, changes only apply locally.
            console.log("Clear list operation not sent to cloud: User not verified.");
        }
    }

    // Bookmarks Specific Logic
    async function syncBookmarkListFromFirestore(listId, storageKey, type) {
        startTopLoader();
        const collectionName = storageKey.replace('bookmarks_', '') + 'Bookmarks';
        const collectionRef = getUserCollectionRef(collectionName);
        console.log(`[syncBookmarkListFromFirestore] Attempting to sync ${collectionName}. currentUser:`, currentUser ? currentUser.uid : 'null', 'collectionRef:', collectionRef);


        if (firestoreUnsubscribe[collectionName]) {
            firestoreUnsubscribe[collectionName]();
            firestoreUnsubscribe[collectionName] = null;
            console.log(`[syncBookmarkListFromFirestore] Unsubscribed existing listener for ${collectionName}.`);
        }

        // If no user or user is not verified, we don't set up the Firestore listener for writes.
        if (!collectionRef || !currentUser || !currentUser.emailVerified) {
            console.warn(`[syncBookmarkListFromFirestore] Skipping Firestore sync for ${collectionName}: No collectionRef, or user not logged in/verified.`);
            // Local storage data should already be rendered by initializePageLists
            return;
        }

        // Show loading indicator only if localStorage is empty and we're expecting cloud data
        const localData = getBookmarkListFromLocalStorage(storageKey);
        if (localData.length === 0) { // Only show loading if currently empty and expecting cloud data
            const ulElement = document.getElementById(listId);
            if (ulElement) {
                ulElement.innerHTML = `<li class="empty-message">Loading...</li>`;
                console.log(`[syncBookmarkListFromFirestore] Showing loading for ${collectionName}.`);
            }
        }

        // Set up Firestore listener
        firestoreUnsubscribe[collectionName] = collectionRef.orderBy('timestamp').onSnapshot(snapshot => {
            if (window.isImportingData) { return; }
            console.log(`[onSnapshot] Received snapshot for ${collectionName}. Docs:`, snapshot.docs.length);
            try {
                // Suppress early snapshot that would wipe freshly-imported local data
                const localLen = getBookmarkListFromLocalStorage(storageKey).length;
                if (window.lastImportAt && (Date.now() - window.lastImportAt) < 15000 && snapshot.docs.length < localLen) {
                    console.log(`[onSnapshot] Skipping early snapshot for ${collectionName} (server ${snapshot.docs.length} < local ${localLen}).`);
                    finishTopLoader();
                    return;
                }
            } catch (e) {}
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Save the received data to localStorage
            saveBookmarkListToLocalStorage(storageKey, items);
            renderBookmarkListUI(listId, storageKey, type, items);
            console.log(`[onSnapshot] Rendered ${items.length} items for ${collectionName}.`);
            finishTopLoader();
        }, error => {
            console.error("Error listening to Firestore bookmark collection:", collectionName, error);
            window.showConfirmModal('Error', `Could not load ${type} bookmarks from cloud. Displaying local data.`, () => {}, 'OK', '');
            // On error, revert to local storage data
            renderBookmarkListUI(listId, storageKey, type, getBookmarkListFromLocalStorage(storageKey));
            finishTopLoader();
        });
    }

    // IMPORTANT: Modified this function to accept itemData directly for imports
    async function addBookmarkUnified(listId, nameInputId, urlInputId, storageKey, type, itemData = null) {
        let name, url;
        let nameInput = null, urlInput = null;

        if (itemData) { // If itemData is provided (e.g., during import or Enter on URL handler)
            name = itemData.name;
            url = itemData.url;
            // Try to resolve input elements if IDs were provided so we can clear/refocus UI
            if (nameInputId) nameInput = document.getElementById(nameInputId);
            if (urlInputId) urlInput = document.getElementById(urlInputId);
        } else { // If called from UI with input elements
            nameInput = document.getElementById(nameInputId);
            urlInput = document.getElementById(urlInputId);
            name = nameInput.value.trim();
            url = urlInput.value.trim();
        }

        if (!name || !url) {
            if (nameInput) nameInput.classList.add('input-error');
            if (urlInput) urlInput.classList.add('input-error');
            setTimeout(() => { 
                if (nameInput) nameInput.classList.remove('input-error'); 
                if (urlInput) urlInput.classList.remove('input-error'); 
            }, 1500);
            return;
        }
        
        const bookmarkData = { name, url };

        // --- Local Storage (Optimistic & Fallback) ---
        let currentLocalList = getBookmarkListFromLocalStorage(storageKey);
        const isDuplicateLocal = currentLocalList.some(item => item.name === name && item.url === url);

        if (isDuplicateLocal) {
            window.showConfirmModal('Duplicate Bookmark', 'A bookmark with this name and URL already exists locally!', () => {}, '', 'Dismiss');
            if (nameInput) {
                nameInput.classList.add('input-error');
                urlInput.classList.add('input-error');
                setTimeout(() => { nameInput.classList.remove('input-error'); urlInput.classList.remove('input-error'); }, 1500);
            }
            return; // Prevent adding duplicate locally
        }

        // Optimistic UI: Update local storage and render
        currentLocalList.push(bookmarkData);
        saveBookmarkListToLocalStorage(storageKey, currentLocalList);
        renderBookmarkListUI(listId, storageKey, type, currentLocalList);

        // Clear inputs immediately and refocus name
        if (nameInput) {
            nameInput.value = '';
        }
        if (urlInput) {
            urlInput.value = '';
        }
        if (nameInput) {
            nameInput.focus();
        }


        // --- Firestore (Asynchronous Sync) ---
        if (isUserVerifiedForCloudOps()) { // ONLY attempt Firestore if user is verified
            const collectionName = storageKey.replace('bookmarks_', '') + 'Bookmarks';
            const collectionRef = getUserCollectionRef(collectionName);
            if (!collectionRef) {
                console.warn("User verified but collectionRef missing for Firestore add. This is unexpected.");
                window.showConfirmModal('Error', 'Failed to prepare cloud operation. Please try again.', () => {}, 'OK', '');
                return;
            }
            try {
                // Server-side duplicate check
                const existingQuery = await collectionRef.where('name', '==', name).where('url', '==', url).limit(1).get();
                if (!existingQuery.empty) {
                    console.warn("Duplicate detected on Firestore server, reverting local optimistic change.");
                    window.showConfirmModal('Duplicate Bookmark', 'This bookmark already exists in your cloud list! Local change reverted.', () => {}, '', 'Dismiss');
                    // Firestore onSnapshot will automatically revert the UI
                    return;
                }
                await collectionRef.add({ ...bookmarkData, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
            } catch (error) {
                console.error("Error adding bookmark to Firestore:", error);
                // Check if we're offline and show appropriate message
                if (!navigator.onLine) {
                    console.log(`[addBookmarkToFirestore] Offline mode - bookmark "${name}" saved locally, will sync when online`);
                    // Don't show error modal when offline - just log it
                } else {
                    window.showConfirmModal('Connection Error', `Failed to add "${name}" to cloud. Local change will persist temporarily.`, () => {}, 'OK', '');
                }
            }
        } else {
            // User not verified, changes only apply locally.
            console.log("Add bookmark operation not sent to cloud: User not verified.");
        }
    }

    async function updateBookmarkUnified(itemId, oldName, oldUrl, newName, newUrl, listId, storageKey, type, nameInput = null, urlInput = null) {
        // --- Local Storage (Optimistic) ---
        let currentLocalList = getBookmarkListFromLocalStorage(storageKey);

        // Client-side duplicate check
        const isDuplicateLocal = currentLocalList.some(item => item.name === newName && item.url === newUrl && !(item.name === oldName && item.url === oldUrl));
        if (isDuplicateLocal) {
            window.showConfirmModal('Duplicate Bookmark', 'A bookmark with this name and URL already exists locally!', () => {}, '', 'Dismiss');
            if (nameInput) {
                nameInput.classList.add('input-error');
                urlInput.classList.add('input-error');
                setTimeout(() => { nameInput.classList.remove('input-error'); urlInput.classList.remove('input-error'); }, 1500);
            }
            // No optimistic update, immediately re-render original state if needed
            renderBookmarkListUI(listId, storageKey, type, getBookmarkListFromLocalStorage(storageKey));
            return;
        }

        // Optimistic UI: Update local storage and render
        currentLocalList = currentLocalList.map(item => item.name === oldName && item.url === oldUrl ? { name: newName, url: newUrl } : item);
        saveBookmarkListToLocalStorage(storageKey, currentLocalList);
        renderBookmarkListUI(listId, storageKey, type, currentLocalList);

        // --- Firestore (Asynchronous Sync) ---
        if (isUserVerifiedForCloudOps()) { // ONLY attempt Firestore if user is verified
            const collectionName = storageKey.replace('bookmarks_', '') + 'Bookmarks';
            const docRef = getUserCollectionRef(collectionName)?.doc(itemId);
            if (!docRef) {
                console.warn("User verified but docRef missing for Firestore update. This is unexpected.");
                window.showConfirmModal('Error', 'Failed to prepare cloud operation. Please try again.', () => {}, 'OK', '');
                return;
            }
            try {
                // Server-side duplicate check
                const collectionRef = getUserCollectionRef(collectionName);
                const existingQuery = await collectionRef.where('name', '==', newName).where('url', '==', newUrl).limit(1).get();
                if (!existingQuery.empty && existingQuery.docs[0].id !== itemId) {
                    console.warn("Duplicate detected on Firestore server during update, reverting local optimistic change.");
                    window.showConfirmModal('Duplicate Bookmark', 'A bookmark with this name and URL already exists in your cloud list! Local change reverted.', () => {}, '', 'Dismiss');
                    return;
                }
                await docRef.update({ name: newName, url: newUrl });
            } catch (error) {
                console.error("Error updating bookmark in Firestore:", error);
                window.showConfirmModal('Error', `Failed to update "${oldName}" in cloud. Local change will persist temporarily.`, () => {}, 'OK', '');
            }
        } else {
            // User not verified, changes only apply locally.
            console.log("Update bookmark operation not sent to cloud: User not verified.");
        }
    }

    async function deleteBookmarkUnified(itemId, name, url, listId, storageKey, type) {
        // --- Local Storage (Optimistic) ---
        let currentLocalList = getBookmarkListFromLocalStorage(storageKey);
        currentLocalList = currentLocalList.filter(item => !(item.name === name && item.url === url));
        saveBookmarkListToLocalStorage(storageKey, currentLocalList);
        renderBookmarkListUI(listId, storageKey, type, currentLocalList);

        // --- Firestore (Asynchronous Sync) ---
        if (isUserVerifiedForCloudOps()) { // ONLY attempt Firestore if user is verified
            const collectionName = storageKey.replace('bookmarks_', '') + 'Bookmarks';
            const docRef = getUserCollectionRef(collectionName)?.doc(itemId);
            if (!docRef) {
                console.warn("User verified but docRef missing for Firestore delete. This is unexpected.");
                window.showConfirmModal('Error', 'Failed to prepare cloud operation. Please try again.', () => {}, 'OK', '');
                return;
            }
            try {
                await docRef.delete();
            } catch (error) {
                console.error("Error deleting bookmark from Firestore:", error);
                window.showConfirmModal('Error', `Failed to delete "${name}" from cloud. Local change will persist temporarily.`, () => {}, 'OK', '');
            }
        } else {
            // User not verified, changes only apply locally.
            console.log("Delete bookmark operation not sent to cloud: User not verified.");
        }
    }

    async function clearBookmarkListUnified(listId, storageKey, type) {
        // --- Local Storage (Optimistic) ---
        saveBookmarkListToLocalStorage(storageKey, []);
        renderBookmarkListUI(listId, storageKey, type, []);

        // --- Firestore (Asynchronous Sync) ---
        if (isUserVerifiedForCloudOps()) { // ONLY attempt Firestore if user is verified
            const collectionName = storageKey.replace('bookmarks_', '') + 'Bookmarks';
            const collectionRef = getUserCollectionRef(collectionName);
            if (!collectionRef) {
                console.warn("User verified but collectionRef missing for Firestore clear. This is unexpected.");
                window.showConfirmModal('Error', 'Failed to prepare cloud operation. Please try again.', () => {}, 'OK', '');
                return;
            }
            try {
                const snapshot = await collectionRef.get();
                if (snapshot.empty) return;

                const batch = db.batch();
                snapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            } catch (error) {
                console.error("Error clearing bookmark collection in Firestore:", error);
                window.showConfirmModal('Error', 'Failed to clear cloud bookmark list. Local change will persist temporarily.', () => {}, 'OK', '');
            }
        } else {
            // User not verified, changes only apply locally.
            console.log("Clear bookmark list operation not sent to cloud: User not verified.");
        }
    }


    // --- Generic List UI Rendering (renamed for clarity and to indicate it's purely for UI) ---
    function renderGenericListUI(type, listData) {
        const ul = document.getElementById(`${type}-list`);
        if (!ul) return;

        ul.innerHTML = ''; // Clear current list HTML

        const h3Element = ul.parentElement.querySelector('h3');
        if (h3Element) {
            const originalTitle = h3Element.getAttribute('data-original-title') || h3Element.textContent.split(' (')[0];
            if (!h3Element.hasAttribute('data-original-title')) {
                h3Element.setAttribute('data-original-title', originalTitle);
            }
            h3Element.textContent = `${originalTitle} (${listData.length})`;
        }

        if (listData.length === 0) {
            const emptyMessage = document.createElement('li');
            emptyMessage.className = 'empty-message';
            let messageText = 'No items here yet!';
            if (type === 'watching' || type === 'completed') {
                messageText = 'No anime here yet! Add your first anime above.';
            } else if (type === 'projects' || type === 'upcoming') {
                messageText = 'No projects here yet! Add your first project above.';
            } else if (type === 'accounts') {
                messageText = 'No accounts saved yet! Add your first account above.';
            } else if (type === 'notes') {
                messageText = 'No notes here yet! Add your first note above.';
            }
            emptyMessage.textContent = messageText;
            ul.appendChild(emptyMessage);
        } else {
            if (typeof expanded[`${type}`] === 'undefined') {
                expanded[`${type}`] = false;
            }
            const visibleList = expanded[`${type}`] ? listData : listData.slice(0, maxVisible);
            visibleList.forEach(item => {
                const li = createGenericItemElement(type, item);
                ul.appendChild(li);
            });
        }
        const viewBtn = ul.nextElementSibling;
        if (viewBtn && viewBtn.classList.contains('view-more')) {
            viewBtn.style.display = listData.length > maxVisible ? 'inline-block' : 'none';
            viewBtn.textContent = expanded[`${type}`] ? 'View Less' : 'View More';
        }
        setLastUpdatedDisplay(type); // Call the unified display function
    }


    function createGenericItemElement(type, itemData) {
        const li = document.createElement('li');
        li.setAttribute('draggable', 'true');
        
        // Use itemData.id for Firestore items, otherwise it's just a string for local storage
        const itemId = itemData.id; 
        const name = typeof itemData === 'string' ? itemData : itemData.name;
        const completed = typeof itemData === 'object' && 'completed' in itemData ? itemData.completed : false;

        li.dataset.itemId = itemId; // Store Firestore ID or undefined
        li.dataset.itemName = name;

        if (itemData.pending) { // Add a class for pending optimistic updates
            li.classList.add('pending-update');
        }

        if (type === 'watching' || type === 'completed') {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'item-checkbox';
            checkbox.checked = completed;

            checkbox.addEventListener('change', async () => {
                // Determine the new intended status immediately so we can revert if needed
                const newCompletedStatus = checkbox.checked;

                // Check verification BEFORE doing local optimistic update to prevent visual inconsistency
                // if the cloud operation is immediately blocked.
                if (currentUser && !currentUser.emailVerified) {
                     window.showConfirmModal('Email Verification Required', 'Please verify your email to toggle item status in the cloud.', () => {}, 'OK', '');
                     checkbox.checked = !newCompletedStatus; // Revert checkbox visual
                     return;
                }

                // Get current state from local storage (or local UI if that's what's currently rendered)
                let localWatching = getListFromLocalStorage('watching');
                let localCompleted = getListFromLocalStorage('completed');

                // Determine original state to revert if needed
                const originalType = type;
                // newCompletedStatus is already determined above
                
                let itemFound = false;
                // Find and remove the item from its original local list
                if (originalType === 'watching') {
                    const idx = localWatching.findIndex(item => item.name === name);
                    if (idx > -1) {
                        localWatching.splice(idx, 1);
                        itemFound = true;
                    }
                } else { // originalType === 'completed'
                    const idx = localCompleted.findIndex(item => item.name === name);
                    if (idx > -1) {
                        localCompleted.splice(idx, 1);
                        itemFound = true;
                    }
                }

                if (!itemFound) {
                    console.warn("Item not found in local list for toggle, skipping optimistic update.");
                    return;
                }

                // Add to the target local list with new status
                const targetListType = newCompletedStatus ? 'completed' : 'watching';
                const newItemData = { name: name, completed: newCompletedStatus };
                if (targetListType === 'completed') {
                    localCompleted.push(newItemData);
                } else {
                    localWatching.push(newItemData);
                }

                // Optimistically update localStorage and UI
                saveListToLocalStorage('watching', localWatching);
                saveListToLocalStorage('completed', localCompleted);
                renderGenericListUI('watching', localWatching);
                renderGenericListUI('completed', localCompleted);

                // --- Firestore (Asynchronous Sync) ---
                if (isUserVerifiedForCloudOps() && itemId) { // ONLY attempt Firestore if user is verified AND we have an itemId
                    try {
                        // Use a batch write for atomicity if moving between collections
                        const batch = db.batch();
                        
                        // Delete from the original collection in Firestore
                        const originalCollectionRef = getUserCollectionRef(originalType);
                        if (originalCollectionRef) {
                            batch.delete(originalCollectionRef.doc(itemId));
                        }

                        // Add to the target collection in Firestore
                        const targetCollectionRef = getUserCollectionRef(targetListType);
                        if (targetCollectionRef) {
                             batch.set(targetCollectionRef.doc(itemId), { ...newItemData, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
                             // Use set with itemId if it's already a known Firestore ID
                             // If it was a temporary ID, Firestore's add will create a new one, but that's handled by onSnapshot
                        }

                        await batch.commit();

                    } catch (error) {
                        console.error('Error in Firestore anime status toggle:', error);
                        window.showConfirmModal('Error', 'Failed to update anime status in cloud. Local change will persist temporarily.', () => {}, 'OK', '');
                        // onSnapshot listeners will eventually correct the UI if server fails
                    }
                } else if (currentUser && !itemId) { // User is logged in, but item had no Firestore ID (e.g., newly added locally but failed to sync)
                    console.warn("Item has no Firestore ID, cannot sync toggle for unpersisted item.");
                    window.showConfirmModal('Sync Warning', 'This item was not yet synced to the cloud. Its status change will only be local.', () => {}, 'OK', '');
                } else {
                    console.log("Toggle operation not sent to cloud: User not logged in/verified.");
                }
            });
            li.appendChild(checkbox);
        }

        const itemTextSpan = document.createElement('span');
        itemTextSpan.className = 'item-text';
        itemTextSpan.textContent = name;
        if (completed) {
            itemTextSpan.classList.add('completed-item-text');
        }
        li.appendChild(itemTextSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-actions';

        const editBtn = document.createElement('span');
        editBtn.textContent = 'Edit';
        editBtn.className = 'action-btn';
        editBtn.onclick = (event) => {
            event.stopPropagation();
            editGenericItem(li, itemData, type);
        };
        actionsDiv.appendChild(editBtn);

        const deleteBtn = document.createElement('span');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'action-btn';
        deleteBtn.onclick = async (event) => {
            event.stopPropagation();
            // Build a friendly label for the item type
            const displayLabel = (type === 'watching' || type === 'completed')
                ? 'Anime'
                : (type === 'projects')
                    ? 'Project'
                    : (type === 'upcoming')
                        ? 'Plan'
                        : (type === 'accounts')
                            ? 'Account'
                            : (type === 'notes')
                                ? 'Note'
                                : 'Item';
            window.showConfirmModal(
                `Delete ${displayLabel}`,
                `Are you sure you want to delete "${name}"?`,
                async () => {
                    // ItemToDeleteData contains id, name, completed status
                    await deleteItemUnified(type, itemData, name);
                },
                'Delete',
                'Cancel'
            );
        };
        actionsDiv.appendChild(deleteBtn);

        li.appendChild(actionsDiv);

        // Drag and Drop Logic (mostly remains local, but needs to update Firestore if applicable)
        li.addEventListener('dragstart', (e) => {
            draggedItem = { element: li, data: itemData, type: type, itemId: itemId };
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify(itemData)); // Stringify object for data transfer
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

        li.addEventListener('drop', async (e) => {
            e.preventDefault();
            li.classList.remove('drag-over');

            if (draggedItem && draggedItem.type === type && draggedItem.element !== li) {
                if (currentUser && currentUser.emailVerified) { // If user is verified, remind reorder is visual only
                    window.showConfirmModal('Reorder', 'Drag and Drop reordering is visual only in cloud mode. To persist order, a dedicated "order" field is needed.', () => {}, 'OK', '');
                } else {
                    let currentList = getListFromLocalStorage(type);
                    const draggedDataName = typeof draggedItem.data === 'string' ? draggedItem.data : draggedItem.data.name; // Get name for localStorage string
                    const dropTargetName = li.dataset.itemName;

                    let draggedIndex = -1;
                    let dropTargetIndex = -1;

                    // Ensure comparison is by name for localStorage
                    draggedIndex = currentList.findIndex(item => (typeof item === 'string' ? item === draggedDataName : item.name === draggedDataName));
                    dropTargetIndex = currentList.findIndex(item => (typeof item === 'string' ? item === dropTargetName : item.name === dropTargetName));

                    if (draggedIndex > -1 && dropTargetIndex > -1) {
                        const [removed] = currentList.splice(draggedIndex, 1);
                        currentList.splice(dropTargetIndex, 0, removed);
                        saveListToLocalStorage(type, currentList);
                        renderGenericListUI(type, currentList);
                    }
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


    // `addItem` now calls the unified add function
    window.addItem = async function(type) {
        const input = document.getElementById(`${type}-input`);
        if (!input) return;

        const value = input.value.trim();
        if (!value) {
            input.classList.add('input-error');
            setTimeout(() => { input.classList.remove('input-error'); }, 1500);
            return;
        }

        let itemData;
        if (type === 'watching' || type === 'completed') {
            itemData = { name: value, completed: (type === 'completed') };
        } else {
            itemData = { name: value };
        }
        await addItemUnified(type, itemData, input);
    };

    // Enable "Enter to add" on all generic list input fields
    const inputTypes = ['watching','completed','projects','upcoming','accounts','notes'];
    inputTypes.forEach(t => {
        const el = document.getElementById(`${t}-input`);
        if (el) {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    window.addItem(t);
                }
            });
        }
    });

    // Bookmarks input behavior:
    // - Enter on NAME moves focus to URL (if name filled)
    // - Enter on URL adds the bookmark and refocuses NAME (cleared by add flow)
    const bookmarkTypes = ['tools', 'entertainment'];
    bookmarkTypes.forEach(type => {
        const nameEl = document.getElementById(`${type}-name`);
        const urlEl = document.getElementById(`${type}-url`);
        if (nameEl) {
            nameEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const nameVal = nameEl.value.trim();
                    if (!nameVal) {
                        nameEl.classList.add('input-error');
                        setTimeout(() => nameEl.classList.remove('input-error'), 1500);
                        return;
                    }
                    if (urlEl) {
                        urlEl.focus();
                        try { urlEl.select(); } catch (err) {}
                    }
                }
            });
        }
        if (urlEl) {
            urlEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    window.addBookmark(`${type}-list`, `${type}-name`, `${type}-url`, `bookmarks_${type}`, type);
                }
            });
        }
    });

    window.clearList = async function(type) {
        window.showConfirmModal(
            `Clear All ${type.charAt(0).toUpperCase() + type.slice(1)}`,
            `Are you sure you want to clear all items from the ${type} list? This action cannot be undone.`,
            async () => {
                await clearListUnified(type);
            },
            'Yes, Clear All',
            'No, Keep It'
        );
    };

    function editGenericItem(li, oldItemData, type) {
        const oldName = typeof oldItemData === 'string' ? oldItemData : oldItemData.name;
        const itemId = oldItemData.id; // Get Firestore ID if it exists
        
        li.innerHTML = '';
        li.classList.add('editing-item');
        li.removeAttribute('draggable');

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = oldName;
        nameInput.className = 'edit-input';
        // Select all text for immediate overwrite typing UX
        try { nameInput.select(); } catch (e) { /* ignore */ }

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.onclick = async () => {
            const newName = nameInput.value.trim();
            if (!newName) {
                nameInput.classList.add('input-error');
                setTimeout(() => { nameInput.classList.remove('input-error'); }, 1500);
                return;
            }

            const newItemData = { name: newName };
            // Ensure completed status is preserved for anime
            if (type === 'watching' || type === 'completed') {
                 newItemData.completed = (typeof oldItemData === 'object' && 'completed' in oldItemData) ? oldItemData.completed : false;
            }

            await updateItemUnified(type, oldItemData, newItemData, nameInput); // Pass nameInput for error styling

            li.classList.remove('editing-item'); // Optimistically remove editing state
            // UI re-render handled by sync/optimistic update
        };

        // Allow Enter key to save while editing
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveBtn.click();
            }
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            li.classList.remove('editing-item');
            // Revert to current local storage state
            renderGenericListUI(type, getListFromLocalStorage(type));
        };

        li.appendChild(nameInput);
        const editActionsDiv = document.createElement('div');
        editActionsDiv.className = 'item-actions';
        editActionsDiv.appendChild(saveBtn);
        editActionsDiv.appendChild(cancelBtn);
        li.appendChild(editActionsDiv);

        // Focus and select AFTER element is in DOM
        try { nameInput.focus(); nameInput.select(); } catch (e) {}
    }

    // `toggleView` now uses the unified sync functions
    window.toggleView = function(type) {
        expanded[`${type}`] = !expanded[`${type}`];
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage === 'bookmarks.html') {
            let listId, storageKey;
            if (type === 'tools') {
                listId = 'tools-list';
                storageKey = 'bookmarks_tools';
            } else if (type === 'entertainment') {
                listId = 'entertainment-list';
                storageKey = 'bookmarks_entertainment';
            }
            // Simply re-render from the current local storage state based on expansion
            renderBookmarkListUI(listId, storageKey, type, getBookmarkListFromLocalStorage(storageKey));
        } else {
            // Simply re-render from the current local storage state based on expansion
            renderGenericListUI(type, getListFromLocalStorage(type));
        }
    };


    // --- Bookmarks Specific Logic ---

    // Unified render function for Bookmark UI updates
    function renderBookmarkListUI(listId, storageKey, type, itemsData) {
        const ul = document.getElementById(listId);
        if (!ul) return;

        ul.innerHTML = ''; // Clear current list HTML

        const h3Element = ul.parentElement.querySelector('h3');
        if (h3Element) {
            const originalTitle = h3Element.getAttribute('data-original-title') || h3Element.textContent.split(' (')[0];
            if (!h3Element.hasAttribute('data-original-title')) {
                h3Element.setAttribute('data-original-title', originalTitle);
            }
            h3Element.textContent = `${originalTitle} (${itemsData.length})`;
        }

        if (itemsData.length === 0) {
            const emptyMessage = document.createElement('li');
            emptyMessage.className = 'empty-message';
            const messageText = `No ${type} bookmarks here yet! Add your first bookmark above.`;
            emptyMessage.textContent = messageText;
            ul.appendChild(emptyMessage);
        } else {
            if (typeof expanded[`${type}`] === 'undefined') {
                expanded[`${type}`] = false;
            }

            const visibleItems = expanded[`${type}`] ? itemsData : itemsData.slice(0, maxVisible);
            visibleItems.forEach(item => { // item will have id, name, url
                const li = createBookmarkElement(item.id, item.name, item.url, listId, storageKey, type);
                ul.appendChild(li);
            });
        }
        const viewBtn = ul.nextElementSibling;
        if (viewBtn && viewBtn.classList.contains('view-more')) {
            viewBtn.style.display = itemsData.length > maxVisible ? 'inline-block' : 'none';
            viewBtn.textContent = expanded[`${type}`] ? 'View Less' : 'View More';
        }
        setLastUpdatedDisplay(listId, storageKey); // Call the unified display function
    }


    function createBookmarkElement(itemId, name, url, listId, storageKey, type) {
        const li = document.createElement('li');
        li.setAttribute('draggable', 'true');
        li.dataset.itemId = itemId; // Store Firestore ID
        li.dataset.itemName = name;
        li.dataset.itemUrl = url;

        if (itemId && typeof itemId === 'string' && itemId.startsWith('temp_')) { // Add class for pending optimistic updates
            li.classList.add('pending-update');
        }

        const itemTextSpan = document.createElement('span');
        itemTextSpan.className = 'item-text';
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = name;
        itemTextSpan.appendChild(a);
        li.appendChild(itemTextSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-actions';

        const editBtn = document.createElement('span');
        editBtn.textContent = 'Edit';
        editBtn.className = 'action-btn';
        editBtn.onclick = (event) => {
            event.stopPropagation();
            editBookmark(li, itemId, name, url, listId, storageKey, type);
        };
        actionsDiv.appendChild(editBtn);

        const deleteBtn = document.createElement('span');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'action-btn';
        deleteBtn.onclick = async (event) => {
            event.stopPropagation();
            window.showConfirmModal(
                `Delete Bookmark`,
                `Are you sure you want to delete "${name}"?`,
                async () => {
                    await deleteBookmarkUnified(itemId, name, url, listId, storageKey, type);
                },
                'Delete',
                'Cancel'
            );
        };
        actionsDiv.appendChild(deleteBtn);

        li.appendChild(actionsDiv);

        li.addEventListener('dragstart', (e) => {
            draggedItem = { element: li, data: { id: itemId, name: name, url: url }, type: type, isBookmark: true };
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify({ id: itemId, name: name, url: url }));
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

        li.addEventListener('drop', async (e) => {
            e.preventDefault();
            li.classList.remove('drag-over');

            if (draggedItem && draggedItem.type === type && draggedItem.element !== li && draggedItem.isBookmark) {
                 if (currentUser && currentUser.emailVerified) { // If user is verified, remind reorder is visual only
                    window.showConfirmModal('Reorder', 'Drag and Drop reordering is visual only in cloud mode. To persist order, a dedicated "order" field is needed.', () => {}, 'OK', '');
                } else {
                    let currentList = getBookmarkListFromLocalStorage(storageKey);
                    const draggedBookmark = draggedItem.data;
                    const dropTargetName = li.dataset.itemName;
                    const dropTargetUrl = li.dataset.itemUrl;

                    const draggedIndex = currentList.findIndex(item => item.name === draggedBookmark.name && item.url === draggedBookmark.url);
                    const dropTargetIndex = currentList.findIndex(item => item.name === dropTargetName && item.url === dropTargetUrl);

                    if (draggedIndex > -1 && dropTargetIndex > -1) {
                        const [removed] = currentList.splice(draggedIndex, 1);
                        currentList.splice(dropTargetIndex, 0, removed);
                        saveBookmarkListToLocalStorage(storageKey, currentList);
                        renderBookmarkListUI(listId, storageKey, type, currentList);
                    }
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

    window.addBookmark = async function(listId, nameInputId, urlInputId, storageKey, type) {
        const nameInput = document.getElementById(nameInputId);
        const urlInput = document.getElementById(urlInputId);

        const name = nameInput.value.trim();
        const url = urlInput.value.trim();

        if (!name || !url) {
            if (!name) {
                nameInput.classList.add('input-error');
                setTimeout(() => { nameInput.classList.remove('input-error'); }, 1500);
            }
            if (!url) {
                urlInput.classList.add('input-error');
                setTimeout(() => { urlInput.classList.remove('input-error'); }, 1500);
            }
            return;
        }
        
        const bookmarkData = { name, url };

        // Pass the bookmarkData object directly, and input elements for UI feedback
        await addBookmarkUnified(listId, nameInputId, urlInputId, storageKey, type, bookmarkData);
    };

    window.clearBookmarkList = async function(listId, storageKey, type) {
        window.showConfirmModal(
            `Clear All ${type.charAt(0).toUpperCase() + type.slice(1)} Bookmarks`,
            `Are you sure you want to clear all ${type} bookmarks? This action cannot be undone.`,
            async () => {
                await clearBookmarkListUnified(listId, storageKey, type);
            },
            'Yes, Clear All',
            'No, Keep It'
        );
    };

    function editBookmark(li, itemId, oldName, oldUrl, listId, storageKey, type) {
        li.innerHTML = '';
        li.classList.add('editing-item');
        li.removeAttribute('draggable');

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = oldName;
        nameInput.className = 'edit-input';
        // Select all text for immediate overwrite typing UX
        try { nameInput.select(); } catch (e) { /* ignore */ }

        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.value = oldUrl;
        urlInput.className = 'edit-input';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.onclick = async () => {
            const newName = nameInput.value.trim();
            const newUrl = urlInput.value.trim();
            if (!newName || !newUrl) {
                if (!newName) {
                    nameInput.classList.add('input-error');
                    setTimeout(() => { nameInput.classList.remove('input-error'); }, 1500);
                }
                if (!newUrl) {
                    urlInput.classList.add('input-error');
                    setTimeout(() => { urlInput.classList.remove('input-error'); }, 1500);
                }
                return;
            }

            await updateBookmarkUnified(itemId, oldName, oldUrl, newName, newUrl, listId, storageKey, type, nameInput, urlInput);
            li.classList.remove('editing-item'); // Optimistically remove editing state
        };

        // Allow Enter key to save from either field while editing
        const saveOnEnter = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveBtn.click();
            }
        };
        nameInput.addEventListener('keydown', saveOnEnter);
        urlInput.addEventListener('keydown', saveOnEnter);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            li.classList.remove('editing-item');
            // Revert to current local storage state
            renderBookmarkListUI(listId, storageKey, type, getBookmarkListFromLocalStorage(storageKey));
        };

        li.appendChild(nameInput);
        li.appendChild(urlInput);
        const editActionsDiv = document.createElement('div');
        editActionsDiv.className = 'item-actions';
        editActionsDiv.appendChild(saveBtn);
        editActionsDiv.appendChild(cancelBtn);
        li.appendChild(editActionsDiv);

        // Focus and select AFTER elements are in DOM
        try { nameInput.focus(); nameInput.select(); } catch (e) {}
    }

    // --- Export/Import Data Functions (Now globally available, but listeners here still) ---
    // These functions are now primarily located here, and listeners will be moved to profile.html
    const localStorageKeys = [
        'watchingList', 'watchingLastUpdated',
        'completedList', 'completedLastUpdated',
        'projectsList', 'projectsLastUpdated',
        'upcomingList', 'upcomingLastUpdated',
        'bookmarks_tools', 'bookmarks_tools_lastUpdated',
        'bookmarks_entertainment', 'bookmarks_entertainment_lastUpdated',
        'vaultPassword',
        'vaultFailedAttempts',
        'accountsList', 'accountsLastUpdated',
        'notesList', 'notesLastUpdated'
    ];

    // Make exportData and importData globally available if they need to be called from HTML
    window.exportData = function() {
        const data = {};
        localStorageKeys.forEach(key => {
            const item = localStorage.getItem(key);
            if (item !== null) {
                try {
                    data[key] = JSON.parse(item);
                } catch (e) {
                    data[key] = item;
                }
            }
        });

        const jsonData = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `my_hub_data_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        window.showConfirmModal('Export Successful', 'Data exported successfully!', () => {}, 'OK', '');
    }

    window.importData = function(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        window.showConfirmModal(
            'Confirm Data Import',
            'Importing will MERGE the file contents with your current data (duplicates will be skipped). Proceed?',
            async () => { // Made async to handle Firestore writes
                const reader = new FileReader();
                reader.onload = async (e) => { // Made async
                    try {
                        const importedData = JSON.parse(e.target.result);
                        window.isImportingData = true;
                        window.lastImportAt = Date.now();
                        
                        // Helper to parse array or JSON string
                        const parseItems = (val) => (typeof val === 'string' ? JSON.parse(val) : val) || [];

                        // Merge Generic Lists (including vault lists)
                        const genericKeys = [
                            'watchingList','completedList','projectsList','upcomingList','accountsList','notesList'
                        ];
                        for (const key of genericKeys) {
                            if (!Object.prototype.hasOwnProperty.call(importedData, key)) continue;
                            const items = parseItems(importedData[key]);
                            const type = key.replace('List',''); // e.g., watchingList -> watching
                            for (const item of items) {
                                const payload = typeof item === 'string' ? { name: item } : item;
                                await addItemUnified(type, payload);
                            }
                        }

                        // Merge Bookmarks
                        const bookmarkKeys = ['bookmarks_tools','bookmarks_entertainment'];
                        for (const key of bookmarkKeys) {
                            if (!Object.prototype.hasOwnProperty.call(importedData, key)) continue;
                            const items = parseItems(importedData[key]);
                            const type = key.replace('bookmarks_',''); // tools | entertainment
                            const listId = `${type}-list`;
                            for (const item of items) {
                                const name = item.name || '';
                                const url = item.url || '';
                                if (name && url) {
                                    await addBookmarkUnified(listId, null, null, key, type, { name, url });
                                }
                            }
                        }

                        // Re-render lists in-place without reloading to avoid race conditions
                        try {
                            // Generic lists (render only if elements exist on current page)
                            renderGenericListUI('watching', getListFromLocalStorage('watching'));
                            renderGenericListUI('completed', getListFromLocalStorage('completed'));
                            renderGenericListUI('projects', getListFromLocalStorage('projects'));
                            renderGenericListUI('upcoming', getListFromLocalStorage('upcoming'));
                            renderGenericListUI('accounts', getListFromLocalStorage('accounts'));
                            renderGenericListUI('notes', getListFromLocalStorage('notes'));
                            // Bookmarks (render if elements exist)
                            renderBookmarkListUI('tools-list', 'bookmarks_tools', 'tools', getBookmarkListFromLocalStorage('bookmarks_tools'));
                            renderBookmarkListUI('entertainment-list', 'bookmarks_entertainment', 'entertainment', getBookmarkListFromLocalStorage('bookmarks_entertainment'));
                        } catch (e) { console.warn('Post-import re-render warning:', e); }

                        window.showConfirmModal('Import Successful', 'Data merged successfully!', () => {}, 'OK', '');
                        window.isImportingData = false;

                    } catch (error) {
                        window.showConfirmModal('Import Error', 'Failed to import data. Please ensure it\'s a valid JSON file.', () => {}, 'OK', '');
                        console.error('Import error:', error);
                        window.isImportingData = false;
                    } finally {
                        event.target.value = '';
                    }
                };
                reader.readAsText(file);
            },
            'Yes, Merge',
            'No, Cancel'
        );
        event.target.value = '';
    }

    // Attach event listeners for Export/Import buttons (currently on index.html)
    // THESE WILL BE MOVED TO profile.html LATER. KEEP THEM HERE FOR NOW FOR EXISTING index.html FUNCTIONALITY
    const exportDataBtn = document.getElementById('exportDataBtn');
    const importDataBtn = document.getElementById('importDataBtn');
    const importFileInput = document.getElementById('importFileInput');

    if (exportDataBtn && importDataBtn && importFileInput) {
        exportDataBtn.addEventListener('click', window.exportData);
        importDataBtn.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', window.importData);
    }

    // --- Page-specific initialization logic ---
    // This function will render the appropriate lists based on the current page.
    function initializePageLists(isUserLoggedIn) {
        const pageFileName = window.location.pathname.split('/').pop();
        console.log(`[initializePageLists] Initializing lists for ${pageFileName}. Is user logged in? ${isUserLoggedIn}`);

        // Update currentUser based on the value from navbar.js (which updates immediately on auth state change)
        // This ensures the current firebase user is available for getUserCollectionRef and isUserVerifiedForCloudOps
        currentUser = window.currentUserNav;


        if (pageFileName === 'anime.html') {
            // Always render from local storage first for instant display
            renderGenericListUI('watching', getListFromLocalStorage('watching'));
            renderGenericListUI('completed', getListFromLocalStorage('completed'));
            // Then, if user is logged in AND verified, set up Firestore listeners for real-time sync
            if (isUserLoggedIn && currentUser && currentUser.emailVerified) {
                syncGenericListFromFirestore('watching');
                syncGenericListFromFirestore('completed');
            } else if (isUserLoggedIn && currentUser && !currentUser.emailVerified) {
                console.warn("User is logged in but not email verified. Not syncing anime/projects lists with Firestore.");
            }
        } else if (pageFileName === 'projects.html') {
            renderGenericListUI('projects', getListFromLocalStorage('projects'));
            renderGenericListUI('upcoming', getListFromLocalStorage('upcoming'));
            if (isUserLoggedIn && currentUser && currentUser.emailVerified) {
                syncGenericListFromFirestore('projects');
                syncGenericListFromFirestore('upcoming');
            } else if (isUserLoggedIn && currentUser && !currentUser.emailVerified) {
                console.warn("User is logged in but not email verified. Not syncing anime/projects lists with Firestore.");
            }
        } else if (pageFileName === 'vault.html') {
            // Vault lists (local-first, cloud-sync when verified)
            renderGenericListUI('accounts', getListFromLocalStorage('accounts'));
            renderGenericListUI('notes', getListFromLocalStorage('notes'));
            if (isUserLoggedIn && currentUser && currentUser.emailVerified) {
                syncGenericListFromFirestore('accounts');
                syncGenericListFromFirestore('notes');
            } else if (isUserLoggedIn && currentUser && !currentUser.emailVerified) {
                console.warn("User is logged in but not email verified. Not syncing vault lists with Firestore.");
            }
        } else if (pageFileName === 'bookmarks.html') {
            renderBookmarkListUI('tools-list', 'bookmarks_tools', 'tools', getBookmarkListFromLocalStorage('bookmarks_tools'));
            renderBookmarkListUI('entertainment-list', 'bookmarks_entertainment', 'entertainment', getBookmarkListFromLocalStorage('bookmarks_entertainment'));
            if (isUserLoggedIn && currentUser && currentUser.emailVerified) {
                syncBookmarkListFromFirestore('tools-list', 'bookmarks_tools', 'tools');
                syncBookmarkListFromFirestore('entertainment-list', 'bookmarks_entertainment', 'entertainment');
            } else if (isUserLoggedIn && currentUser && !currentUser.emailVerified) {
                console.warn("User is logged in but not email verified. Not syncing bookmark lists with Firestore.");
            }
        }
        // No lists to initialize for index.html directly by this function
    }

    // Initial page list rendering on DOMContentLoaded
    // We explicitly call initializePageLists with `false` to ensure initial rendering from localStorage.
    // The `onAuthStateChanged` callback will then re-trigger it with `true` if a user is logged in.
    initializePageLists(false);

    // Re-initialize lists when navigating back/forward using browser history (pageshow event)
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            console.log('[pageshow] Page loaded from cache (persisted). Re-initializing lists.');
            initializePageLists(currentUser !== null); // Re-evaluate auth state and trigger sync if logged in
        }
    });

}); // End DOMContentLoaded
