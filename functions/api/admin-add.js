/**
 * Endpoint Administrativo: Liberação Manual de Aluno
 * Rota: POST /api/admin-add
 */
export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const secret = request.headers.get('x-admin-secret') || body.secret || '';
        const adminSecret = env.ADMIN_SECRET || 'descanso-admin-2026';

        if (secret !== adminSecret) {
            return new Response(JSON.stringify({ error: 'Não autorizado.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const email = (body.email || '').trim().toLowerCase();
        const name = body.name || email.split('@')[0];

        if (!email || !email.includes('@')) {
            return new Response(JSON.stringify({ error: 'E-mail inválido.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (env.DB) {
            const query = `
                INSERT INTO buyers (email, name, status, platform, order_id, updated_at)
                VALUES (?, ?, 'active', 'manual', 'manual_grant', CURRENT_TIMESTAMP)
                ON CONFLICT(email) DO UPDATE SET
                    status = 'active',
                    name = COALESCE(excluded.name, buyers.name),
                    updated_at = CURRENT_TIMESTAMP;
            `;
            await env.DB.prepare(query).bind(email, name).run();
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Acesso VIP/Manual liberado com sucesso para ${email}` 
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
