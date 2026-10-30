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
                'SELECT email, name, phone, status FROM buyers WHERE email = ? LIMIT 1'
            ).bind(email).first();

            if (!row) {
                return new Response(JSON.stringify({ 
                    authorized: false, 
                    message: 'Nenhum acesso ativo encontrado para este e-mail. Se você já adquiriu o app, entre em contato com nosso WhatsApp oficial para liberação imediata.' 
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            if (row.status !== 'active') {
                return new Response(JSON.stringify({ 
                    authorized: false, 
                    message: `Acesso indisponível (Status: ${row.status}). Entre em contato com nosso suporte.` 
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            return new Response(JSON.stringify({ 
                authorized: true, 
                user: {
                    email: row.email,
                    name: row.name || row.email.split('@')[0],
                    phone: row.phone || ''
                }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Se por algum motivo de infraestrutura o DB não responder, bloqueia acesso e orienta suporte
        return new Response(JSON.stringify({ 
            authorized: false, 
            message: 'Banco de dados temporariamente inacessível. Tente novamente em instantes ou contate o suporte.' 
        }), {
            status: 503,
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
