import fetch from 'node-fetch';

export const getPuuid = async (req, res) => {
  const { nome, tag } = req.query;

  if (!nome || !tag) {
    return res.status(400).json({ error: "Nome e tag são obrigatórios" });
  }

  try {
    const accountRes = await fetch(
      `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(nome)}/${encodeURIComponent(tag)}`,
      { headers: { "X-Riot-Token": process.env.RIOT_API_KEY } }
    );

    if (!accountRes.ok) {
      const error = await accountRes.json();
      return res.status(accountRes.status).json({ 
        error: error.status?.message || "Erro ao buscar conta" 
      });
    }

    const data = await accountRes.json();
    res.json({ puuid: data.puuid });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar PUUID" });
  }
};