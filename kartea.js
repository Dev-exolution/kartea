// ================================
// PAGE SWITCHING FUNCTION
// ================================

function switchPage(pageId) {
    const allPages = document.querySelectorAll('.page-section');
    allPages.forEach(page => {
        page.style.display = 'none';
    });
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.style.display = 'block';
    }
}

// ================================
// AUTHENTICATION FUNCTIONS
// ================================

function togglePassword(inputId = "password", eyeElement = null) {
    const password = document.getElementById(inputId);
    const eye = eyeElement || document.querySelector(".toggle-eye");
    if (!password || !eye) return;

    const isHidden = password.type === "password";
    password.type = isHidden ? "text" : "password";
    if (isHidden) {
        eye.src = "preview-show-interface-icon-free-vector.jpg";
        eye.alt = "Hide password";
    } else {
        eye.src = "eye-close-1.png";
        eye.alt = "Show password";
    }
}

function login(event) {
    event.preventDefault();
    const errorEl = document.getElementById('error-message');
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value.trim();
    if (errorEl) errorEl.innerText = '';

    const user = findUser(email, password);
    if (user) {
        const role = user.role || 'user';
        setRole(role);
        setCurrentUser(email);
        if (errorEl) errorEl.innerText = `${role.charAt(0).toUpperCase() + role.slice(1)} login successful — redirecting...`;
        if (typeof switchPage !== 'undefined') {
            setTimeout(() => {
                if (role === 'admin') {
                    switchPage('admin-page');
                    if (typeof updateUsersList !== 'undefined') updateUsersList();
                } else {
                    switchPage('shop-page');
                }
            }, 500);
        } else {
            if (role === 'admin') {
                window.location.replace("admin.html");
            } else {
                window.location.replace("kartea.html");
            }
        }
        return;
    }

    if (email === "admin@gmail.com" && password === "admin123") {
        setRole('admin');
        setCurrentUser(email);
        if (errorEl) errorEl.innerText = 'Admin login successful — redirecting...';
        if (typeof switchPage !== 'undefined') {
            setTimeout(() => {
                switchPage('admin-page');
                if (typeof updateUsersList !== 'undefined') updateUsersList();
            }, 500);
        } else {
            window.location.replace("admin.html");
        }
        return;
    }

    if (errorEl) errorEl.innerText = "Invalid login credentials. If you don't have an account, sign up first.";
}

function register(event) {
    event.preventDefault();
    const email = document.getElementById('signup-email').value.trim().toLowerCase();
    const password = document.getElementById('signup-password').value.trim();
    const confirm = document.getElementById('signup-confirm').value.trim();

    if (!email || !password || !confirm) {
        alert('Please fill in all fields.');
        return;
    }
    if (password !== confirm) {
        alert('Passwords do not match.');
        return;
    }
    if (email === 'admin@gmail.com') {
        alert('This email is reserved. Please use a different email.');
        return;
    }

    const existing = getUsers().find(u => u.email === email);
    if (existing) {
        alert('This email is already registered. Please log in.');
        return;
    }

    addUser({ email, password, role: 'user' });
    alert('Your account has been created. You can now log in.');
    document.getElementById('signupForm').reset();
    if (typeof switchPage !== 'undefined') {
        switchPage('login-page');
    }
}

function getUsers() {
    const raw = localStorage.getItem('users');
    try {
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function setUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
}

function addUser(user) {
    const users = getUsers();
    users.push(user);
    setUsers(users);
}

function findUser(email, password) {
    const users = getUsers();
    return users.find(u => u.email === email && u.password === password);
}

function setRole(role) {
    localStorage.setItem('role', role);
}

function getRole() {
    return localStorage.getItem('role');
}

function setCurrentUser(email) {
    localStorage.setItem('currentUser', email);
}

function getCurrentUser() {
    return localStorage.getItem('currentUser');
}

function logout() {
    localStorage.removeItem('role');
    localStorage.removeItem('currentUser');
    if (typeof switchPage !== 'undefined') {
        switchPage('login-page');
        document.getElementById('email').value = '';
        document.getElementById('password').value = '';
    } else {
        window.location.href = "kartea.html";
    }
}

function requireRole(expectedRole) {
    const role = getRole();
    if (role !== expectedRole) {
        if (typeof logout !== 'undefined') {
            logout();
        }
    }
}

function getLoginStatusText() {
    const role = getRole();
    const email = getCurrentUser();
    if (!role || !email) return 'Not logged in yet.';
    return `Logged in as ${role} (${email})`;
}

// Check auth on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const role = getRole();
    if (!role) {
        // Not logged in, show login page
        switchPage('login-page');
    } else {
        // Logged in, show appropriate page
        if (role === 'admin') {
            switchPage('admin-page');
            if (typeof updateUsersList !== 'undefined') updateUsersList();
        } else {
            switchPage('shop-page');
        }
    }
    
    const roleStatus = document.getElementById('role-status');
    if (roleStatus) {
        roleStatus.innerText = getLoginStatusText();
    }
});

// ================================
// CART & SHOP FUNCTIONS
// ================================

// structure: { title: { count: n, price: p } }
const CART_KEY = 'cartCounts';
let cartCounts = {};

function loadCart() {
    let dirty = false;
    try {
        const stored = localStorage.getItem(CART_KEY);
        if (stored) cartCounts = JSON.parse(stored);
    } catch (e) {
        console.warn('failed to load cart from localStorage', e);
        cartCounts = {};
    }

    // sanitize any bad values and remove placeholders
    for (const key of Object.keys(cartCounts)) {
        const title = String(key).trim();
        const entry = cartCounts[key];
        if (!title) {
            delete cartCounts[key];
            dirty = true;
            continue;
        }
        if (!entry || typeof entry !== 'object') {
            delete cartCounts[key];
            dirty = true;
            continue;
        }
        if (isNaN(entry.price)) { entry.price = 0; dirty = true; }
        if (isNaN(entry.count)) { entry.count = 0; dirty = true; }
        // if both price and count zero, remove item (likely placeholder)
        if (entry.count === 0 && entry.price === 0) {
            delete cartCounts[key];
            dirty = true;
        }
    }

    if (dirty) {
        // persist cleaned version back to storage to avoid repeat problems
        saveCart();
    }
}

function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cartCounts));
}

function updateCartIndicator() {
    const total = Object.values(cartCounts).reduce((sum,item)=> {
        const n = Number(item.count) || 0;
        return sum + n;
    },0);
    const span = document.getElementById('cart-count');
    if (span) span.textContent = total;
    const checkout = document.getElementById('checkout-btn');
    if (checkout) checkout.disabled = total === 0;
}

function renderCartBox() {
    const box = document.getElementById('cart-box');
    if (!box) return;
    const itemsDiv = box.querySelector('.cart-items');
    itemsDiv.innerHTML = '';
    let totalCost = 0;
    for (const [title,data] of Object.entries(cartCounts)) {
        const count = Number(data.count) || 0;
        if (count === 0) continue; // skip items with zero quantity
        const unitPrice = Number(data.price) || 0;
        const lineTotal = unitPrice * count;

        const line = document.createElement('div');
        line.className = 'cart-item';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${title} x${count}`;
        line.appendChild(nameSpan);

        const unitSpan = document.createElement('span');
        unitSpan.className = 'unit-price';
        unitSpan.textContent = `@₱${unitPrice.toFixed(2)}`;
        line.appendChild(unitSpan);

        const totalSpan = document.createElement('span');
        totalSpan.className = 'line-total';
        totalSpan.textContent = `= ₱${lineTotal.toFixed(2)}`;
        line.appendChild(totalSpan);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.setAttribute('aria-label', `Remove ${title}`);
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromCart(title);
        });
        line.appendChild(removeBtn);

        itemsDiv.appendChild(line);
        totalCost += lineTotal;
    }
    if (isNaN(totalCost)) totalCost = 0;
    const subtotalElem = document.getElementById('cart-subtotal');
    if (subtotalElem) subtotalElem.textContent = totalCost.toFixed(2);
    
    // Calculate and display tax (12%)
    const tax = totalCost * 0.12;
    const taxElem = document.getElementById('cart-tax');
    if (taxElem) taxElem.textContent = tax.toFixed(2);
    
    // Calculate total with tax
    const finalTotal = totalCost + tax;
    const totalElem = document.getElementById('cart-total');
    if (totalElem) totalElem.textContent = finalTotal.toFixed(2);
}

function toggleCartBox(show) {
    const box = document.getElementById('cart-box');
    if (!box) return;
    if (show === undefined) show = !box.classList.contains('show');
    box.classList.toggle('show', show);
}

// close cart if click outside
document.addEventListener('click', (e)=>{
    const box = document.getElementById('cart-box');
    const indicator = document.querySelector('.cart-indicator');
    if (!box || !box.classList.contains('show')) return;
    if (box.contains(e.target) || (indicator && indicator.contains(e.target))) return;
    toggleCartBox(false);
});

// handle Add to Cart via event delegation so clicks still work
// even if elements are hidden or recreated (e.g. during filtering).
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-add-cart');
    if (!btn) return;

    // if overlay is blocking (sidebar open), hide it first
    const overlay = document.getElementById('overlay');
    if (overlay && overlay.classList.contains('show')) {
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
    }

    const itemFrame = btn.closest('.item-frame');
    if (!itemFrame) return;
    const title = (itemFrame.querySelector('.item-title')?.textContent || '').trim();
    const priceText = itemFrame.querySelector('.item-price')?.textContent || '';
    const parsed = parseFloat(priceText.replace(/[^\d.]/g, ''));
    const priceVal = isNaN(parsed) ? 0 : parsed;

    if (!title || priceVal === 0) {
        console.warn('skipping add-to-cart due to missing data', title, priceText);
        return;
    }

    cartCounts[title] = cartCounts[title] || {count:0, price: priceVal};
    cartCounts[title].count++;
    saveCart();
    updateCartIndicator();
    renderCartBox();

    const box = document.getElementById('cart-box');
    if (box && box.classList.contains('show')) {
        const items = box.querySelectorAll('.cart-item');
        items.forEach(i=>{ if (i.textContent.startsWith(title)) i.classList.add('highlight'); });
        setTimeout(()=>{
            items.forEach(i=>i.classList.remove('highlight'));
        }, 500);
    }

    btn.textContent = '✓ Added!';
    setTimeout(() => {
        btn.textContent = 'Add to Cart';
    }, 1500);

    console.log(`${title} - ${priceText} added to cart`);
});

// initialize cart counts when the script loads
loadCart();
updateCartIndicator();
renderCartBox();

// helper to remove item completely
function removeFromCart(title) {
    if (cartCounts[title]) {
        delete cartCounts[title];
        saveCart();
        updateCartIndicator();
        renderCartBox();
    }
}

// toggle cart box when clicking the indicator
const cartIndicator = document.querySelector('.cart-indicator');
if (cartIndicator) {
    cartIndicator.addEventListener('click', () => {
        toggleCartBox();
    });
}
const closeBtn = document.getElementById('cart-close');
if (closeBtn) {
    closeBtn.addEventListener('click', () => toggleCartBox(false));
}

// Checkout button handler
const checkoutBtn = document.getElementById('checkout-btn');
if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const total = document.getElementById('cart-total').textContent;
        if (total && total !== '0.00') {
            // Build receipt items from cart
            const receiptItems = [];
            for (const [title, data] of Object.entries(cartCounts)) {
                const count = Number(data.count) || 0;
                if (count > 0) {
                    const unitPrice = Number(data.price) || 0;
                    const lineTotal = unitPrice * count;
                    receiptItems.push({
                        name: title,
                        quantity: count,
                        unitPrice: unitPrice,
                        lineTotal: lineTotal
                    });
                }
            }
            
            // Save receipt items to localStorage
            localStorage.setItem('receiptItems', JSON.stringify(receiptItems));
            
            // Clear cart after checkout
            cartCounts = {};
            saveCart();
            updateCartIndicator();
            renderCartBox();
            toggleCartBox(false);
            
            // Display receipt and switch to receipt page
            displayReceipt();
            switchPage('receipt-page');
        } else {
            alert('Your cart is empty!');
        }
    });
}

// Search filtering by item name
(function() {
    const form = document.querySelector('.search-bar');
    const input = document.querySelector('.search-input');

    if (!form || !input) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        filterItems(input.value);
    });

    // also live filter while typing
    input.addEventListener('input', function() {
        filterItems(this.value);
    });

    function filterItems(query) {
        const term = query.trim().toLowerCase();
        const grid = document.querySelector('.items-grid');
        if (!grid) return;

        grid.querySelectorAll('.item-frame').forEach(frame => {
            const title = frame.querySelector('.item-title')?.textContent.toLowerCase() || '';
            if (term === '' || title.includes(term)) {
                frame.classList.remove('hidden');
            } else {
                frame.classList.add('hidden');
            }
        });
    }
})();

// Category tab filtering - Switch between sections
(function() {
    const tabs = document.querySelectorAll('.category-tab');
    if (tabs.length === 0) return;

    // Set first tab (ALL) as active by default
    if (tabs[0]) tabs[0].classList.add('active');

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');

            const filter = this.getAttribute('data-filter');
            const sections = document.querySelectorAll('section.category');
            
            sections.forEach(section => {
                if (filter === 'all') {
                    // Show all sections
                    section.style.display = 'block';
                    // Show all items in all sections
                    section.querySelectorAll('.item-frame').forEach(frame => {
                        frame.classList.remove('hidden');
                    });
                } else {
                    // Check if this section matches the filter
                    if (section.classList.contains(filter)) {
                        section.style.display = 'block';
                        // Show all items in this section
                        section.querySelectorAll('.item-frame').forEach(frame => {
                            frame.classList.remove('hidden');
                        });
                    } else {
                        // Hide other sections
                        section.style.display = 'none';
                    }
                }
            });
        });
    });
    
    // Trigger ALL tab on page load to show all items
    if (tabs[0]) {
        tabs[0].click();
    }
})();

// --- merged sidebar functionality ---
(function(){
  const btn = document.querySelector('.toggle-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');

  function isMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');

    const handleTransitionEnd = (e) => {
      if (e.propertyName.includes('transform')) {
        sidebar.classList.remove('overlay-open');
        sidebar.removeEventListener('transitionend', handleTransitionEnd);
      }
    };
    sidebar.addEventListener('transitionend', handleTransitionEnd);
  }

  function openSidebar() {
    sidebar.classList.add('overlay-open');
    void sidebar.offsetWidth;
    sidebar.classList.add('open');
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }

  if (btn) btn.addEventListener('click', () => {
    const isOpen = sidebar.classList.contains('open');
    isOpen ? closeSidebar() : openSidebar();
  });

  if (overlay) overlay.addEventListener('click', closeSidebar);

  window.addEventListener('resize', () => {
    if (!isMobile() && sidebar.classList.contains('open')) {
      closeSidebar();
    }
  });
})();

// ================================
// RECEIPT PAGE FUNCTIONS
// ================================

function getItems() {
    const stored = localStorage.getItem('receiptItems');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Error parsing receipt items:', e);
            return [];
        }
    }
    return [];
}

function displayReceipt() {
    const items = getItems();
    const itemsContainer = document.getElementById('receipt-items');
    if (!itemsContainer) return;
    
    itemsContainer.innerHTML = '';
    let subtotal = 0;
    
    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'receipt-item';
        itemDiv.innerHTML = `
            <div class="receipt-item-name">${item.name} x${item.quantity}</div>
            <div class="receipt-item-price">₱${item.lineTotal.toFixed(2)}</div>
        `;
        itemsContainer.appendChild(itemDiv);
        subtotal += item.lineTotal;
    });
    
    // Calculate tax and total
    const tax = subtotal * 0.12;
    const grandTotal = subtotal + tax;
    
    // Update date
    const dateElement = document.getElementById('receipt-date');
    if (dateElement) {
        dateElement.textContent = new Date().toLocaleString();
    }
    
    // Update grand total
    const totalElement = document.getElementById('grand-total');
    if (totalElement) {
        totalElement.textContent = grandTotal.toFixed(2);
    }
}
