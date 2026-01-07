const API_URL = 'https://vendas-miguel.onrender.com';
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const DEVELOPMENT_MODE = false; // Mudar para true apenas em desenvolvimento local

let vendas = [];
let isOnline = false;
let lastDataHash = '';
let sessionToken = null;

console.log('🚀 Vendas Miguel iniciada');
console.log('📍 API URL:', API_URL);
console.log('🔧 Modo desenvolvimento:', DEVELOPMENT_MODE);

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    if (DEVELOPMENT_MODE) {
        console.log('⚠️ MODO DESENVOLVIMENTO ATIVADO');
        sessionToken = 'dev-mode';
        inicializarApp();
    } else {
        verificarAutenticacao();
    }
});

function verificarAutenticacao() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('sessionToken');

    if (tokenFromUrl) {
        sessionToken = tokenFromUrl;
        sessionStorage.setItem('vendasMiguelSession', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        sessionToken = sessionStorage.getItem('vendasMiguelSession');
    }

    if (!sessionToken) {
        mostrarTelaAcessoNegado();
        return;
    }

    inicializarApp();
}

function mostrarTelaAcessoNegado(mensagem = 'NÃO AUTORIZADO') {
    document.body.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: var(--bg-primary); color: var(--text-primary); text-align: center; padding: 2rem;">
            <h1 style="font-size: 2.2rem; margin-bottom: 1rem;">${mensagem}</h1>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">Somente usuários autenticados podem acessar esta área.</p>
            <a href="${PORTAL_URL}" style="display: inline-block; background: var(--btn-register); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Ir para o Portal</a>
        </div>
    `;
}

function inicializarApp() {
    checkServerStatus();
    loadVendas();
    setInterval(checkServerStatus, 30000); // Check a cada 30s
    setInterval(loadVendas, 60000); // Reload a cada 60s
}

async function checkServerStatus() {
    try {
        const headers = {
            'Accept': 'application/json'
        };
        
        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const response = await fetch(`${API_URL}/../health`, {
            headers: headers
        });

        if (!DEVELOPMENT_MODE && response.status === 401) {
            sessionStorage.removeItem('vendasMiguelSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return false;
        }

        const wasOffline = !isOnline;
        isOnline = response.ok;
        
        if (wasOffline && isOnline) {
            console.log('✅ SERVIDOR ONLINE');
            await loadVendas();
        }
        
        updateConnectionStatus();
        return isOnline;
    } catch (error) {
        console.error('❌ Erro ao verificar servidor:', error);
        isOnline = false;
        updateConnectionStatus();
        return false;
    }
}

function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.className = isOnline ? 'connection-status online' : 'connection-status offline';
    }
}

async function syncData() {
    if (!isOnline) {
        showToast('Sistema offline', 'error');
        return;
    }

    showToast('Sincronizando...', 'success');
    
    try {
        const headers = {
            'Accept': 'application/json'
        };
        
        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const response = await fetch(`${API_URL}/sync`, {
            headers: headers
        });

        if (!DEVELOPMENT_MODE && response.status === 401) {
            sessionStorage.removeItem('vendasMiguelSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return;
        }

        if (!response.ok) throw new Error('Erro na sincronização');
        
        await loadVendas();
        showToast('Dados sincronizados!', 'success');
    } catch (error) {
        console.error('Erro ao sincronizar:', error);
        showToast('Erro ao sincronizar', 'error');
    }
}

async function loadVendas() {
    if (!isOnline) return;

    try {
        const headers = {
            'Accept': 'application/json'
        };
        
        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const response = await fetch(`${API_URL}/vendas`, {
            headers: headers
        });

        if (!DEVELOPMENT_MODE && response.status === 401) {
            sessionStorage.removeItem('vendasMiguelSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return;
        }

        if (!response.ok) throw new Error('Erro ao carregar vendas');

        const data = await response.json();
        vendas = data;
        
        const newHash = JSON.stringify(vendas.map(v => v.id));
        if (newHash !== lastDataHash) {
            lastDataHash = newHash;
            updateDisplay();
        }

        // Carregar dashboard
        await loadDashboard();
    } catch (error) {
        console.error('❌ Erro ao carregar vendas:', error);
    }
}

async function loadDashboard() {
    try {
        const headers = {
            'Accept': 'application/json'
        };
        
        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const response = await fetch(`${API_URL}/dashboard`, {
            headers: headers
        });

        if (!DEVELOPMENT_MODE && response.status === 401) {
            sessionStorage.removeItem('vendasMiguelSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return;
        }

        if (!response.ok) throw new Error('Erro ao carregar dashboard');

        const stats = await response.json();
        
        document.getElementById('totalPago').textContent = formatCurrency(stats.pago);
        document.getElementById('totalAReceber').textContent = formatCurrency(stats.aReceber);
        document.getElementById('totalEntregue').textContent = stats.entregue;
        document.getElementById('totalFaturado').textContent = formatCurrency(stats.faturado);
    } catch (error) {
        console.error('❌ Erro ao carregar dashboard:', error);
    }
}

function filterVendas() {
    updateTable();
}

function updateDisplay() {
    updateTable();
}

function updateTable() {
    const container = document.getElementById('vendasContainer');
    let filteredVendas = [...vendas];
    
    const search = document.getElementById('search').value.toLowerCase();
    const filterOrigem = document.getElementById('filterOrigem').value;
    const filterStatus = document.getElementById('filterStatus').value;
    
    if (search) {
        filteredVendas = filteredVendas.filter(v => 
            (v.numero_nf || '').toLowerCase().includes(search) ||
            (v.nome_orgao || '').toLowerCase().includes(search)
        );
    }
    
    if (filterOrigem) {
        filteredVendas = filteredVendas.filter(v => v.origem === filterOrigem);
    }
    
    if (filterStatus) {
        filteredVendas = filteredVendas.filter(v => {
            if (filterStatus === 'PAGO') return v.origem === 'CONTAS_RECEBER' && v.data_pagamento;
            if (filterStatus === 'ENTREGUE') return v.origem === 'CONTROLE_FRETE' && v.status_frete === 'ENTREGUE';
            if (filterStatus === 'EM_ANDAMENTO') return v.origem === 'CONTROLE_FRETE' && v.status_frete !== 'ENTREGUE';
            return true;
        });
    }
    
    if (filteredVendas.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem;">
                    Nenhuma venda encontrada
                </td>
            </tr>
        `;
        return;
    }
    
    container.innerHTML = filteredVendas.map(venda => {
        const status = getStatus(venda);
        const statusClass = status === 'PAGO' ? 'pago' : status === 'ENTREGUE' ? 'entregue' : 'pendente';
        
        return `
            <tr>
                <td><strong>${venda.numero_nf}</strong></td>
                <td style="white-space: nowrap;">${formatDate(venda.data_emissao)}</td>
                <td>${venda.nome_orgao}</td>
                <td><strong>${formatCurrency(venda.valor_nf)}</strong></td>
                <td>${venda.tipo_nf || '-'}</td>
                <td>
                    <span class="badge ${statusClass}">${status}</span>
                </td>
                <td>
                    <span class="badge origem-${venda.origem.toLowerCase()}">${formatOrigem(venda.origem)}</span>
                </td>
                <td class="actions-cell">
                    <div class="actions">
                        <button onclick="viewVenda('${venda.id}')" class="action-btn view" title="Ver detalhes">Ver</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getStatus(venda) {
    if (venda.origem === 'CONTAS_RECEBER' && venda.data_pagamento) {
        return 'PAGO';
    }
    if (venda.origem === 'CONTROLE_FRETE' && venda.status_frete === 'ENTREGUE') {
        return 'ENTREGUE';
    }
    return 'EM_ANDAMENTO';
}

function formatOrigem(origem) {
    return origem === 'CONTAS_RECEBER' ? 'Contas' : 'Frete';
}

function viewVenda(id) {
    const venda = vendas.find(v => v.id === id);
    if (!venda) return;
    
    document.getElementById('modalNumeroNF').textContent = venda.numero_nf;
    
    const modalBody = document.getElementById('modalBody');
    
    if (venda.origem === 'CONTAS_RECEBER') {
        // Exibir dados de Contas a Receber
        modalBody.innerHTML = `
            <div class="info-section">
                <h4>Informações da Conta</h4>
                <p><strong>Número NF:</strong> ${venda.numero_nf}</p>
                <p><strong>Órgão:</strong> ${venda.nome_orgao}</p>
                <p><strong>Valor:</strong> ${formatCurrency(venda.valor_nf)}</p>
                <p><strong>Data Emissão:</strong> ${formatDate(venda.data_emissao)}</p>
                <p><strong>Data Vencimento:</strong> ${formatDate(venda.data_vencimento)}</p>
                <p><strong>Data Pagamento:</strong> ${venda.data_pagamento ? formatDate(venda.data_pagamento) : '-'}</p>
                <p><strong>Banco:</strong> ${venda.banco || '-'}</p>
                <p><strong>Status:</strong> <span class="badge pago">${venda.status_pagamento}</span></p>
                ${venda.observacoes ? `<p><strong>Observações:</strong> ${venda.observacoes}</p>` : ''}
            </div>
        `;
    } else {
        // Exibir dados de Controle de Frete
        modalBody.innerHTML = `
            <div class="info-section">
                <h4>Informações do Frete</h4>
                <p><strong>Número NF:</strong> ${venda.numero_nf}</p>
                <p><strong>Órgão:</strong> ${venda.nome_orgao}</p>
                <p><strong>Valor NF:</strong> ${formatCurrency(venda.valor_nf)}</p>
                <p><strong>Data Emissão:</strong> ${formatDate(venda.data_emissao)}</p>
                ${venda.documento ? `<p><strong>Documento:</strong> ${venda.documento}</p>` : ''}
                ${venda.contato_orgao ? `<p><strong>Contato:</strong> ${venda.contato_orgao}</p>` : ''}
                <p><strong>Transportadora:</strong> ${venda.transportadora || '-'}</p>
                <p><strong>Valor Frete:</strong> ${formatCurrency(venda.valor_frete)}</p>
                ${venda.data_coleta ? `<p><strong>Data Coleta:</strong> ${formatDate(venda.data_coleta)}</p>` : ''}
                ${venda.cidade_destino ? `<p><strong>Cidade Destino:</strong> ${venda.cidade_destino}</p>` : ''}
                ${venda.previsao_entrega ? `<p><strong>Previsão Entrega:</strong> ${formatDate(venda.previsao_entrega)}</p>` : ''}
                <p><strong>Status:</strong> <span class="badge entregue">${venda.status_frete}</span></p>
            </div>
        `;
    }
    
    document.getElementById('infoModal').classList.add('show');
}

function closeInfoModal() {
    const modal = document.getElementById('infoModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function formatCurrency(value) {
    if (!value) return 'R$ 0,00';
    const num = parseFloat(value);
    return `R$ ${num.toFixed(2).replace('.', ',')}`;
}

function showToast(message, type = 'success') {
    const oldMessages = document.querySelectorAll('.floating-message');
    oldMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `floating-message ${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOutBottom 0.3s ease forwards';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}
