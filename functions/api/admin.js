/**
 * API Administrativa do Modo Descanso
 * Rotas suportadas:
 * GET  /api/admin?action=list     -> Lista todos os compradores registrados
 * POST /api/admin?action=add      -> Cadastra ou reativa manualmente um usuário
 * POST /api/admin?action=status   -> Altera status (active, blocked, refunded)
 * POST /api/admin?action=delete   -> Remove um usuário
 */

function checkAuth(request, env) {
    const adminSecret = env.ADMIN_SECRET || 'descanso-admin-2026';
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const querySecret = new URL(request.url).searchParams.get('secret') || '';
    const headerSecret = request.headers.get('x-admin-secret') || '';

    return (token === adminSecret || querySecret === adminSecret || headerSecret === adminSecret);
}

export async function onRequestGet(context) {
    const { request, env } = context;

    if (!checkAuth(request, env)) {
        return new Response(JSON.stringify({ error: 'Não autorizado.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!env.DB) {
        return new Response(JSON.stringify({ error: 'Banco D1 não configurado.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const { results } = await env.DB.prepare(
            'SELECT id, email, name, phone, status, platform, order_id, created_at, updated_at FROM buyers ORDER BY id DESC'
        ).all();

        return new Response(JSON.stringify({ 
            success: true, 
            buyers: results || [],
            total: results ? results.length : 0
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;

    if (!checkAuth(request, env)) {
        return new Response(JSON.stringify({ error: 'Não autorizado.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!env.DB) {
        return new Response(JSON.stringify({ error: 'Banco D1 não configurado.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const url = new URL(request.url);
        const action = url.searchParams.get('action') || 'add';
        const body = await request.json();

        if (action === 'add') {
            const email = (body.email || '').trim().toLowerCase();
            const name = (body.name || '').trim() || email.split('@')[0];
            const phone = (body.phone || '').trim();
            const platform = (body.platform || 'manual').trim();

            if (!email || !email.includes('@')) {
                return new Response(JSON.stringify({ error: 'Informe um e-mail válido.' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const query = `
                INSERT INTO buyers (email, name, phone, status, platform, order_id, updated_at)
                VALUES (?, ?, ?, 'active', ?, 'manual_grant', CURRENT_TIMESTAMP)
                ON CONFLICT(email) DO UPDATE SET
                    status = 'active',
                    name = COALESCE(excluded.name, buyers.name),
                    phone = COALESCE(NULLIF(excluded.phone, ''), buyers.phone),
                    updated_at = CURRENT_TIMESTAMP;
            `;
            await env.DB.prepare(query).bind(email, name, phone, platform).run();

            return new Response(JSON.stringify({ 
                success: true, 
                message: `Usuário ${email} liberado com sucesso!` 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (action === 'status') {
            const email = (body.email || '').trim().toLowerCase();
            const status = (body.status || 'active').trim();

            await env.DB.prepare(
                'UPDATE buyers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?'
            ).bind(status, email).run();

            return new Response(JSON.stringify({ 
                success: true, 
                message: `Status de ${email} alterado para ${status}.` 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (action === 'delete') {
            const email = (body.email || '').trim().toLowerCase();

            await env.DB.prepare('DELETE FROM buyers WHERE email = ?').bind(email).run();

            return new Response(JSON.stringify({ 
                success: true, 
                message: `Usuário ${email} removido do sistema.` 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: 'Ação não reconhecida.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

