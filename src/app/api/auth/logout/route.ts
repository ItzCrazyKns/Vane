import { deleteSession, getAuthEnabled } from '@/lib/auth';
import { verifySessionCookie } from '@/lib/auth/cookie';

export const POST = async (req: Request) => {
  if (!getAuthEnabled()) {
    return Response.json(
      { error: 'Authentication is not enabled' },
      { status: 404 },
    );
  }

  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/session_id=([^;]+)/);
    const cookie = match?.[1];

    if (cookie) {
      const payload = await verifySessionCookie(cookie);
      if (payload?.sessionId) {
        deleteSession(payload.sessionId);
      }
    }

    const response = Response.json({ success: true }, { status: 200 });
    response.headers.set(
      'Set-Cookie',
      `session_id=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
    );

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
};
