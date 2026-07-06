const configs = [
    { id: 'oficial', keys: ['Oficial'], l: 'Banco Nación' },
    { id: 'blue', keys: ['Blue'], l: 'Mercado Informal' },
    { id: 'tarjeta', keys: ['Tarjeta'], l: 'Impuestos' },
    { id: 'mep', keys: ['Bolsa', 'MEP'], l: 'Bolsa' },
    { id: 'ccl', keys: ['Contado con liquidación', 'CCL'], l: 'Liqui' },
    { id: 'cripto', keys: ['Cripto', 'Bitcoin'], l: 'Stablecoin' }
];

const HISTORY_LENGTH = 20;
const container = document.querySelector('.main-container');
const loadingOverlay = document.getElementById('loading-overlay');
const errorBanner = document.getElementById('error-banner');
const errorMessage = document.getElementById('error-message');
const lastUpdateEl = document.getElementById('last-update');
const montoInput = document.getElementById('monto-usuario');

let charts = {};
let lastPrices = {};
let priceHistory = {};
let isFirstLoad = true;
let isFetching = false;

const formatARS = (value) =>
    new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const formatUSD = (value) =>
    new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const isLightMode = () => document.body.classList.contains('light-mode');

const getChartColor = () => (isLightMode() ? '#0284C7' : '#38BDF8');

function getChartOptions(id) {
    const color = getChartColor();
    return {
        chart: {
            type: 'area',
            height: 70,
            sparkline: { enabled: true },
            animations: { enabled: true, speed: 400 },
            background: 'transparent',
            toolbar: { show: false },
            fontFamily: 'Inter, sans-serif'
        },
        stroke: { curve: 'smooth', width: 2 },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.35,
                opacityTo: 0.02,
                stops: [0, 100]
            }
        },
        colors: [color],
        series: [{ name: 'Venta', data: [...priceHistory[id]] }],
        tooltip: {
            enabled: true,
            theme: isLightMode() ? 'light' : 'dark',
            x: { show: false },
            y: {
                formatter: (val) => `$ ${formatARS(val)}`
            }
        }
    };
}

function initChart(id) {
    const el = document.getElementById(`chart-${id}`);
    if (!el || typeof ApexCharts === 'undefined' || !priceHistory[id]?.length) return;

    charts[id] = new ApexCharts(el, getChartOptions(id));
    charts[id].render();
}

function updateChart(id) {
    if (!charts[id]) return;
    charts[id].updateOptions({
        colors: [getChartColor()],
        series: [{ data: [...priceHistory[id]] }],
        tooltip: { theme: isLightMode() ? 'light' : 'dark' }
    });
}

function ensureChart(id) {
    if (!priceHistory[id]?.length) return;
    if (!charts[id]) initChart(id);
    else updateChart(id);
}

function pushPriceHistory(id, price) {
    if (!priceHistory[id]) priceHistory[id] = [];
    if (priceHistory[id].length === 0) {
        priceHistory[id] = [price, price, price];
    } else {
        priceHistory[id].push(price);
    }
    if (priceHistory[id].length > HISTORY_LENGTH) {
        priceHistory[id] = priceHistory[id].slice(-HISTORY_LENGTH);
    }
}

function setLoading(active) {
    isFetching = active;
    loadingOverlay.classList.toggle('visible', active && isFirstLoad);
    loadingOverlay.setAttribute('aria-hidden', active && isFirstLoad ? 'false' : 'true');
    lastUpdateEl.classList.toggle('is-loading', active);

    if (active && !isFirstLoad) {
        lastUpdateEl.dataset.prevText = lastUpdateEl.textContent;
        lastUpdateEl.textContent = 'Actualizando...';
    } else if (!active && lastUpdateEl.dataset.prevText) {
        lastUpdateEl.textContent = lastUpdateEl.dataset.prevText;
        delete lastUpdateEl.dataset.prevText;
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorBanner.hidden = false;
    errorBanner.classList.add('visible');
    lastUpdateEl.classList.add('has-error');
}

function hideError() {
    errorBanner.hidden = true;
    errorBanner.classList.remove('visible');
    lastUpdateEl.classList.remove('has-error');
}

function sanitizeMontoInput() {
    let raw = montoInput.value.replace(/[^\d.,]/g, '');
    raw = raw.replace(/,/g, '.');

    const parts = raw.split('.');
    if (parts.length > 2) {
        raw = `${parts[0]}.${parts.slice(1).join('')}`;
    }

    if (parts.length === 2 && parts[1].length > 2) {
        raw = `${parts[0]}.${parts[1].slice(0, 2)}`;
    }

    if (montoInput.value !== raw) {
        montoInput.value = raw;
    }

    return raw === '' || raw === '.' ? NaN : parseFloat(raw);
}

function validarYConvertir() {
    const monto = sanitizeMontoInput();

    configs.forEach((m) => {
        const display = document.getElementById(`${m.id}-converted`);
        if (!isNaN(monto) && monto > 0 && lastPrices[m.id]) {
            const res = monto / lastPrices[m.id];
            display.textContent = `RECIBÍS: ${formatUSD(res)} USD`;
        } else {
            display.textContent = '';
        }
    });
}

window.validarYConvertir = validarYConvertir;

if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-mode');
}

configs.forEach((m) => {
    priceHistory[m.id] = [];
    container.innerHTML += `
    <article class="card" id="card-${m.id}">
        <div class="card-top">
            <h2>${m.id.toUpperCase()}</h2>
            <span class="label-tag">${m.l}</span>
        </div>
        <div class="info-group">
            <div class="small-label">Compra</div>
            <div class="price-val" id="${m.id}-compra">---</div>
        </div>
        <div class="info-group">
            <div class="small-label">Venta</div>
            <div class="main-price" id="${m.id}-venta">---</div>
            <span class="spread-tag" id="${m.id}-spread">DIFERENCIA: ---</span>
            <div class="converted-val" id="${m.id}-converted"></div>
        </div>
        <div class="chart-wrap" id="chart-${m.id}" aria-hidden="true"></div>
    </article>`;
});

async function update() {
    if (isFetching) return;

    setLoading(true);

    try {
        const res = await fetch('https://dolarapi.com/v1/dolares');
        if (!res.ok) throw new Error(`Error del servidor (${res.status})`);

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('La API no devolvió cotizaciones válidas');
        }

        let updatedCount = 0;

        data.forEach((item) => {
            const c = configs.find((x) => x.keys.includes(item.nombre));
            if (c && item.venta) {
                lastPrices[c.id] = item.venta;
                pushPriceHistory(c.id, item.venta);

                document.getElementById(`${c.id}-compra`).textContent =
                    item.compra ? `$ ${formatARS(item.compra)}` : '---';
                document.getElementById(`${c.id}-venta`).textContent = `$ ${formatARS(item.venta)}`;

                const spread = item.compra ? item.venta - item.compra : null;
                document.getElementById(`${c.id}-spread`).textContent =
                    spread !== null ? `DIFERENCIA: $ ${formatARS(spread)}` : 'DIFERENCIA: --';

                ensureChart(c.id);
                updatedCount++;
            }
        });

        if (updatedCount === 0) throw new Error('No se encontraron cotizaciones compatibles');

        hideError();
        lastUpdateEl.textContent = `Actualizado: ${new Date().toLocaleTimeString('es-AR')}`;
        validarYConvertir();
        isFirstLoad = false;
    } catch (err) {
        console.error('Error al actualizar precios:', err);
        showError('No se pudieron obtener las cotizaciones. Reintentando en 10 segundos...');
        if (isFirstLoad) {
            lastUpdateEl.textContent = 'Sin conexión';
        }
    } finally {
        setLoading(false);
    }
}

document.getElementById('theme-toggle').onclick = () => {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLightMode() ? 'light' : 'dark');
    configs.forEach((m) => {
        if (charts[m.id]) updateChart(m.id);
    });
};

document.getElementById('error-dismiss').onclick = () => {
    hideError();
};

montoInput.addEventListener('input', validarYConvertir);
montoInput.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    const cleaned = pasted.replace(/[^\d.,]/g, '').replace(/,/g, '.');
    montoInput.value = cleaned;
    validarYConvertir();
});

montoInput.addEventListener('keydown', (e) => {
    const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (allowed.includes(e.key)) return;
    if (/^[0-9]$/.test(e.key)) return;
    if ((e.key === '.' || e.key === ',') && !montoInput.value.includes('.') && !montoInput.value.includes(',')) return;
    e.preventDefault();
});

setInterval(update, 10000);
update();
