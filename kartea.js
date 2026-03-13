// persistent cart data stored in localStorage
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
        removeBtn.addEventListener('click', () => {
            removeFromCart(title);
        });
        line.appendChild(removeBtn);

        itemsDiv.appendChild(line);
        totalCost += lineTotal;
    }
    if (isNaN(totalCost)) totalCost = 0;
    const totalElem = document.getElementById('cart-total');
    if (totalElem) totalElem.textContent = totalCost.toFixed(2);
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
        // manage headings
        document.querySelectorAll('section.category > h1, section.category > h2').forEach(h => {
            if (term === '') {
                h.classList.remove('hidden');
            } else {
                h.classList.add('hidden');
            }
        });

        const grid = document.querySelector('.items-grid');
        if (grid) {
            // collect matched items so we can move them to the front
            const matches = [];
            grid.querySelectorAll('.item-frame').forEach(frame => {
                const title = frame.querySelector('.item-title')?.textContent.toLowerCase() || '';
                if (term === '' || title.includes(term)) {
                    frame.classList.remove('hidden');
                    matches.push(frame);
                } else {
                    frame.classList.add('hidden');
                }
            });
            // reorder matched frames to top (preserving their relative order)
            if (term !== '' && matches.length) {
                matches.forEach(m => grid.insertBefore(m, grid.firstChild));
            }
        }

        // remove any leftover priority class when search is cleared
        if (term === '') {
            document.querySelectorAll('.item-frame.priority').forEach(f => f.classList.remove('priority'));
        }
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
