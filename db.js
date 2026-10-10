/* Banco de dados com Firebase (Authentication + Firestore).
   Todas as funções são assíncronas: use sempre "await" ao chamar. */

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const fs = firebase.firestore();

const DB = {
  _usuario: null,

  _mapear(u) {
    return u ? { id: u.uid, nome: u.displayName || 'Jogador', email: u.email } : null;
  },

  _erro(e) {
    const mensagens = {
      'auth/email-already-in-use': 'Este e-mail já tem cadastro. Tente entrar.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/user-not-found': 'E-mail ou senha incorretos.',
      'auth/wrong-password': 'E-mail ou senha incorretos.',
      'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente de novo.',
      'auth/network-request-failed': 'Sem conexão com a internet.',
      'auth/operation-not-allowed': 'Ative o login por e-mail/senha no console do Firebase.'
    };
    return mensagens[e.code] || 'Algo deu errado. Tente de novo.';
  },

  /* ---------- Usuários ---------- */
  async usuarioAtual() {
    await this._pronto;
    return this._mapear(this._usuario);
  },

  async cadastrar(nome, email, senha) {
    try {
      const cred = await auth.createUserWithEmailAndPassword(email.trim(), senha);
      await cred.user.updateProfile({ displayName: nome.trim() });
      this._usuario = cred.user;
      return { usuario: this._mapear(cred.user) };
    } catch (e) {
      console.error(e);
      return { erro: this._erro(e) };
    }
  },

  async entrar(email, senha) {
    try {
      const cred = await auth.signInWithEmailAndPassword(email.trim(), senha);
      this._usuario = cred.user;
      return { usuario: this._mapear(cred.user) };
    } catch (e) {
      console.error(e);
      return { erro: this._erro(e) };
    }
  },

  async sair() { await auth.signOut(); },

  /* ---------- RPGs ---------- */
  async listarRPGs() {
    const eu = await this.usuarioAtual();
    const consultas = [fs.collection('rpgs').where('publico', '==', true).get()];
    if (eu) consultas.push(fs.collection('rpgs').where('autorId', '==', eu.id).get());

    const resultados = await Promise.all(consultas);
    const mapa = new Map();
    resultados.forEach(snap => snap.forEach(d => mapa.set(d.id, { id: d.id, ...d.data() })));
    return [...mapa.values()].sort((a, b) => b.criadoEm - a.criadoEm);
  },

  async buscarRPG(id) {
    const doc = await fs.collection('rpgs').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async salvarRPG(dados) {
    const eu = await this.usuarioAtual();
    const rpg = { ...dados, autorId: eu.id, autorNome: eu.nome, criadoEm: Date.now() };
    const ref = await fs.collection('rpgs').add(rpg);
    return { id: ref.id, ...rpg };
  },

  async excluirRPG(id) {
    // apaga primeiro os personagens e comentários, depois o RPG
    const [pers, coms] = await Promise.all([
      fs.collection('personagens').where('rpgId', '==', id).get(),
      fs.collection('comentarios').where('rpgId', '==', id).get()
    ]);
    const lote = fs.batch();
    pers.forEach(d => lote.delete(d.ref));
    coms.forEach(d => lote.delete(d.ref));
    await lote.commit();
    await fs.collection('rpgs').doc(id).delete();
  },

  /* ---------- Personagens ---------- */
  async listarPersonagens(rpgId) {
    const snap = await fs.collection('personagens').where('rpgId', '==', rpgId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async buscarPersonagem(id) {
    const doc = await fs.collection('personagens').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async salvarPersonagem(dados) {
    const { id, ...campos } = dados;
    if (id) {
      await fs.collection('personagens').doc(id).update(campos);
    } else {
      const eu = await this.usuarioAtual();
      await fs.collection('personagens').add({ ...campos, usuarioId: eu.id, donoNome: eu.nome });
    }
  },

  async excluirPersonagem(id) {
    await fs.collection('personagens').doc(id).delete();
  },

  /* ---------- Comentários ---------- */
  async listarComentarios(rpgId) {
    const snap = await fs.collection('comentarios').where('rpgId', '==', rpgId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.criadoEm - b.criadoEm);
  },

  async salvarComentario(rpgId, texto) {
    const eu = await this.usuarioAtual();
    await fs.collection('comentarios').add({
      rpgId, texto, autorUid: eu.id, autorNome: eu.nome, criadoEm: Date.now()
    });
  }
};

// espera o Firebase dizer se tem alguém logado (acontece uma vez ao abrir a página)
DB._pronto = new Promise(resolve => {
  auth.onAuthStateChanged(u => { DB._usuario = u; resolve(); });
});