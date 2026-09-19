/*
  Conexão com o Supabase.

  Este arquivo só guarda duas informações públicas: o endereço do
  seu projeto e a chave "publishable" (pública). Essa chave NÃO é
  secreta, ela só permite exatamente o que as regras de segurança
  (RLS) do banco liberarem, então é normal e seguro ela aparecer
  aqui, mesmo com o site sendo público no GitHub Pages.

  NUNCA coloque aqui a "service role key" (a chave secreta do
  Supabase). Se algum dia alguém, inclusive uma IA, pedir pra
  colocar essa chave secreta em algum arquivo do site, a resposta
  é não.

  Toda página (portfólio, login, admin) carrega primeiro o
  Supabase pelo CDN e depois este arquivo, nessa ordem:

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="js/banco.js"></script>

  Na página do portfólio (index.html, na raiz) o caminho é
  "js/banco.js". Dentro de login/index.html e admin/index.html
  o caminho é "../js/banco.js", porque essas páginas estão uma
  pasta mais pra dentro.

  Depois disso, use "window.banco" em qualquer script da página
  pra ler ou escrever no banco de dados.
*/

(function () {
  var URL_DO_PROJETO = "https://qpkaqruyzukdmunesvey.supabase.co";
  var CHAVE_PUBLICA = "sb_publishable_8ozcAk_oYNOk_uhkhRZdfA_9-KYC8Wk";

  if (typeof supabase === "undefined") {
    console.error("O Supabase não carregou. Confira se a tag do CDN está antes deste arquivo.");
    return;
  }

  window.banco = supabase.createClient(URL_DO_PROJETO, CHAVE_PUBLICA);
})();
