import fetch from 'node-fetch';

export async function getProfile(req, res) {
  const { puuid } = req.query;

  if (!puuid) {
    return res.status(400).json({ error: "PUUID é obrigatório" });
  }

  try {
    // 1. Busca informações básicas do invocador
    const summonerRes = await fetch(
      `https://br1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
      { headers: { "X-Riot-Token": process.env.RIOT_API_KEY } }
    );

    if (!summonerRes.ok) {
      const error = await summonerRes.json();
      throw new Error(error.status?.message || "Erro ao buscar invocador");
    }

    const summonerData = await summonerRes.json();

    // ... (restante da lógica igual ao original)

    res.json(responseData);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar perfil" });
  }
}