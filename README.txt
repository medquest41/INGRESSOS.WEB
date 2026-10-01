INGRESSOS WEB - VERSAO PRONTA PARA EXTRAIR

1) Extraia a pasta ingressos-local em:
   D:\SITE-INGRESSOS\

2) O caminho final deve ficar:
   D:\SITE-INGRESSOS\ingressos-local

3) Clique duas vezes em:
   INICIAR SITE INGRESSOS.bat

Na primeira vez ele instala as dependencias automaticamente e abre o navegador.

ROTAS PRINCIPAIS
- Cliente: http://localhost:5173/
- Meus ingressos: http://localhost:5173/ingressos
- Admin: http://localhost:5173/admin

IMPORTANTE
- Esta versao usa localStorage para eventos, pedidos e check-in.
- Ainda nao usa Supabase nem Mercado Pago real.
- O painel Admin ja permite criar, editar, publicar/ocultar e excluir eventos,
  gerenciar tipos de ingresso e validar codigos de ingresso localmente.
- Depois conectaremos autenticação, banco, pagamentos e producao.
