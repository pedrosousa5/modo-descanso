/**
 * Endpoint de Verificação de Acesso no Login
 * Rota: POST /api/verify
 */
export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const email = (body.email || '').trim().toLowerCase();

        if (!email || !email.includes('@')) {
            return new Response(JSON.stringify({ 
                authorized: false, 
                message: 'Informe um e-mail válido para verificar o acesso.' 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Se o banco D1 estiver conectado na Cloudflare
        if (env.DB) {
            const row = await env.DB.prepare(
                'SELECT email, name, status FROM buyers WHERE email = ? LIMIT 1'
            ).bind(email).first();

            if (!row) {
                return new Response(JSON.stringify({ 
                    authorized: false, 
                    message: 'Nenhuma compra ativa encontrada com este e-mail. Verifique se utilizou o mesmo e-mail do checkout.' 
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            if (row.status !== 'active') {
                return new Response(JSON.stringify({ 
                    authorized: false, 
                    message: `Acesso indisponível (Status: ${row.status}). Entre em contato com o suporte.` 
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            return new Response(JSON.stringify({ 
                authorized: true, 
                user: {
                    email: row.email,
                    name: row.name || row.email.split('@')[0]
                }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Modo de demonstração / fallback caso o D1 ainda não esteja vinculado
        return new Response(JSON.stringify({ 
            authorized: true, 
            demo: true,
            user: {
                email: email,
                name: email.split('@')[0]
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ 
            authorized: false, 
            message: 'Erro interno ao validar acesso. Tente novamente em instantes.' 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
