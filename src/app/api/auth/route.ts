import { NextRequest, NextResponse } from 'next/server';

export const POST = async (req: NextRequest) => {
  try {
    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret) {
      return NextResponse.json(
        { message: 'Admin authentication is not configured.' },
        { status: 200 },
      );
    }

    const body = await req.json();
    const { secret } = body;

    if (!secret || secret !== adminSecret) {
      return NextResponse.json(
        { message: 'Invalid admin secret.' },
        { status: 403 },
      );
    }

    const response = NextResponse.json(
      { message: 'Authenticated.' },
      { status: 200 },
    );

    response.cookies.set('vane-admin-token', adminSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    console.error('Error in admin auth: ', err);
    return NextResponse.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const DELETE = async () => {
  try {
    const response = NextResponse.json(
      { message: 'Logged out.' },
      { status: 200 },
    );

    response.cookies.delete('vane-admin-token');

    return response;
  } catch (err) {
    console.error('Error in admin logout: ', err);
    return NextResponse.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
