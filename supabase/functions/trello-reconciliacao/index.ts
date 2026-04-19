import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface TrelloBoard {
  id: string;
  name: string;
  closed: boolean;
}

interface TrelloCard {
  id: string;
  name: string;
  idBoard: string;
  closed: boolean;
  url: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("TRELLO_API_KEY");
    const token = Deno.env.get("TRELLO_TOKEN");

    if (!apiKey || !token) {
      return new Response(
        JSON.stringify({ error: "Trello credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const auth = `key=${apiKey}&token=${token}`;

    // 1. Fetch all boards (member's boards, including org boards)
    const boardsRes = await fetch(
      `https://api.trello.com/1/members/me/boards?fields=id,name,closed&filter=open&${auth}`
    );
    if (!boardsRes.ok) {
      const text = await boardsRes.text();
      throw new Error(`Trello boards fetch failed [${boardsRes.status}]: ${text}`);
    }
    const boards: TrelloBoard[] = await boardsRes.json();
    const openBoards = boards.filter((b) => !b.closed);

    // 2. Fetch all cards for each board (parallel)
    const cardsByBoard = await Promise.all(
      openBoards.map(async (board) => {
        const cardsRes = await fetch(
          `https://api.trello.com/1/boards/${board.id}/cards?fields=id,name,idBoard,closed,url&${auth}`
        );
        if (!cardsRes.ok) return { board, cards: [] as TrelloCard[] };
        const cards: TrelloCard[] = await cardsRes.json();
        return { board, cards: cards.filter((c) => !c.closed) };
      })
    );

    return new Response(
      JSON.stringify({
        boards: openBoards,
        cardsByBoard: cardsByBoard.map(({ board, cards }) => ({
          boardId: board.id,
          boardName: board.name,
          cards,
        })),
        totalBoards: openBoards.length,
        totalCards: cardsByBoard.reduce((sum, b) => sum + b.cards.length, 0),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("trello-reconciliacao error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
