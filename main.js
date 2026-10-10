/* Funções usadas em todas as páginas */

// Protege o texto digitado pelo usuário antes de colocar no HTML
function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function param(nome) { return new URLSearchParams(location.search).get(nome); }

function paginaAtual() { return location.pathname.split('/').pop() || 'index.html'; }

// Se não estiver logado, manda para o login e volta depois
async function exigirLogin() {
  if (await DB.usuarioAtual()) return true;
  const volta = paginaAtual() + location.search;
  location.href = 'login.html?volta=' + encodeURIComponent(volta);
  return false;
}

async function montarTopo() {
  const eu = await DB.usuarioAtual();
  const atual = paginaAtual();
  const link = (href, texto) =>
    `<a href="${href}"${atual === href ? ' aria-current="page"' : ''}>${texto}</a>`;

  document.getElementById('topo').innerHTML = `
    <div class="topo-in">
      <a class="logo" href="index.html">Mesa Aberta</a>
      <nav aria-label="Principal">
        ${link('index.html', 'Início')}
        ${link('criar.html', 'Criar RPG')}
        ${eu
          ? `<span class="ola">Olá, ${esc(eu.nome)}</span><button class="btn-link" id="btn-sair">Sair</button>`
          : link('login.html', 'Entrar')}
      </nav>
    </div>`;

  const sair = document.getElementById('btn-sair');
  if (sair) sair.addEventListener('click', async () => { await DB.sair(); location.href = 'index.html'; });
}

document.addEventListener('DOMContentLoaded', montarTopo);