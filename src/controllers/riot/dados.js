import fetch from 'node-fetch';

export const getData = async (req, res) => {
  const { nome, tag, tipo } = req.query;

  // Validação dos parâmetros
  if (!nome || !tag || !tipo) {
    return res.status(400).json({
      error: "Parâmetros obrigatórios faltando",
      required: ["nome", "tag", "tipo"],
      received: { nome, tag, tipo },
      tipos_aceitos: ["maestria", "winrate"]
    });
  }

  // Validar tipo de consulta
  if (!["maestria", "winrate"].includes(tipo)) {
    return res.status(400).json({
      error: "Tipo de consulta inválido",
      tipos_validos: ["maestria", "winrate"]
    });
  }

  try {
    // 1. Obter PUUID do jogador
    const accountResponse = await fetch(
      `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(nome)}/${encodeURIComponent(tag)}`,
      {
        headers: {
          "X-Riot-Token": process.env.RIOT_API_KEY,
          "Accept-Charset": "application/x-www-form-urlencoded; charset=UTF-8"
        }
      }
    );

    if (!accountResponse.ok) {
      const errorData = await accountResponse.json();
      return res.status(accountResponse.status).json({
        error: errorData.status?.message || "Erro ao buscar conta na Riot API",
        statusCode: accountResponse.status
      });
    }

    const { puuid } = await accountResponse.json();

    // 2. Processar conforme o tipo solicitado
    if (tipo === "maestria") {
      return await handleMaestria(res, puuid);
    } else if (tipo === "winrate") {
      return await handleWinrate(res, puuid);
    }

  } catch (error) {
    console.error("Erro no processamento:", error);
    return res.status(500).json({
      error: "Erro interno ao processar a requisição",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Função para tratar dados de maestria
const handleMaestria = async (res, puuid) => {
  try {
    const [masteryResponse, championsResponse] = await Promise.all([
      fetch(`https://br1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`, {
        headers: { "X-Riot-Token": process.env.RIOT_API_KEY }
      }),
      fetch('https://ddragon.leagueoflegends.com/cdn/14.8.1/data/pt_BR/champion.json')
    ]);

    // Verificar respostas
    if (!masteryResponse.ok) {
      const errorData = await masteryResponse.json();
      throw new Error(errorData.status?.message || "Erro ao buscar maestria");
    }

    if (!championsResponse.ok) {
      throw new Error("Erro ao buscar dados dos campeões");
    }

    const masteryData = await masteryResponse.json();
    const championsData = (await championsResponse.json()).data;

    // Processar top 10 campeões
    const top10 = masteryData.slice(0, 10).map((mastery, index) => {
      const champion = Object.values(championsData).find(c => parseInt(c.key) === mastery.championId);
      
      return {
        posicao: index + 1,
        nome: champion?.name || `Campeão ${mastery.championId}`,
        id: champion?.id || mastery.championId,
        nivel: mastery.championLevel,
        pontos: mastery.championPoints,
        pontos_proximo_nivel: mastery.championPointsSinceLastLevel,
        ultima_jogada: new Date(mastery.lastPlayTime).toISOString(),
        icone: champion 
          ? `https://ddragon.leagueoflegends.com/cdn/14.8.1/img/champion/${champion.image.full}`
          : null,
        chest: mastery.chestGranted
      };
    });

    res.status(200).json({
      tipo: "maestria",
      summonerPuuid: puuid,
      atualizado_em: new Date().toISOString(),
      dados: top10
    });

  } catch (error) {
    console.error("Erro no processamento de maestria:", error);
    throw error;
  }
};

// Função para tratar dados de winrate
const handleWinrate = async (res, puuid) => {
  try {
    // Obter IDs das últimas 20 partidas ranqueadas
    const matchesResponse = await fetch(
      `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=20`,
      { headers: { "X-Riot-Token": process.env.RIOT_API_KEY } }
    );

    if (!matchesResponse.ok) {
      const errorData = await matchesResponse.json();
      throw new Error(errorData.status?.message || "Erro ao buscar histórico de partidas");
    }

    const matchIds = await matchesResponse.json();

    // Processar partidas em paralelo
    const matchesData = await Promise.allSettled(
      matchIds.map(matchId => 
        fetch(`https://americas.api.riotgames.com/lol/match/v5/matches/${matchId}`, {
          headers: { "X-Riot-Token": process.env.RIOT_API_KEY }
        }).then(res => res.ok ? res.json() : null)
      )
    );

    // Calcular estatísticas
    let vitorias = 0;
    let total = 0;
    const detalhesPartidas = [];

    for (const result of matchesData) {
      if (result.status === 'fulfilled' && result.value) {
        const match = result.value;
        const participant = match.info.participants.find(p => p.puuid === puuid);
        
        if (participant) {
          total++;
          if (participant.win) vitorias++;
          
          detalhesPartidas.push({
            matchId: match.metadata.matchId,
            gameMode: match.info.gameMode,
            gameDuration: match.info.gameDuration,
            win: participant.win,
            champion: participant.championName,
            kills: participant.kills,
            deaths: participant.deaths,
            assists: participant.assists,
            kda: parseFloat(((participant.kills + participant.assists) / Math.max(participant.deaths, 1)).toFixed(2)),
            cs: participant.totalMinionsKilled + (participant.neutralMinionsKilled || 0),
            visionScore: participant.visionScore,
            items: [
              participant.item0,
              participant.item1,
              participant.item2,
              participant.item3,
              participant.item4,
              participant.item5,
              participant.item6
            ].filter(id => id !== 0)
          });
        }
      }
    }

    const winrate = total > 0 ? ((vitorias / total) * 100).toFixed(2) : 0;

    res.status(200).json({
      tipo: "winrate",
      summonerPuuid: puuid,
      atualizado_em: new Date().toISOString(),
      dados: {
        winrate: `${winrate}%`,
        vitorias,
        derrotas: total - vitorias,
        total_partidas: total,
        detalhes_partidas: detalhesPartidas
      }
    });

  } catch (error) {
    console.error("Erro no processamento de winrate:", error);
    throw error;
  }
};