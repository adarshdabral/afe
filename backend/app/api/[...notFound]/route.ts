// Unknown /api/* paths → JSON 404 in the API envelope (instead of the HTML page).
import { NextResponse } from "next/server";

const notFound = () => NextResponse.json({ error: { message: "Not found." } }, { status: 404 });
export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
