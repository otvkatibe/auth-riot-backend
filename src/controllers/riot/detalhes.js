import fetch from 'node-fetch';

export const getDetails = async (req, res) => {
  const { nome, tag, champion } = req.query;

  // Validação dos parâmetros
  if (!nome || !tag || !champion) {
    return res.status(400).json({ 
      error: "Parâmetros obrigatórios faltando",
      required: ["nome", "tag", "champion"],
      received: { nome, tag, champion }
    });
  }

  try {
    // 1. Obter PUUID
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

    // 2. Obter ID do campeão
    const championsResponse = await fetch(
      'https://ddragon.leagueoflegends.com/cdn/14.8.1/data/pt_BR/champion.json'
    );
    const championsData = await championsResponse.json();
    const championData = Object.values(championsData.data).find(c => c.id === champion);
    
    if (!championData) {
      return res.status(404).json({ 
        error: "Campeão não encontrado",
        championSearched: champion,
        availableChampions: Object.keys(championsData.data).slice(0, 10) // Mostra apenas os 10 primeiros para exemplo
      });
    }
    const championId = championData.key;

    // 3. Obter IDs das partidas recentes
    const matchesResponse = await fetch(
      `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=20`,
      { headers: { "X-Riot-Token": process.env.RIOT_API_KEY } }
    );

    if (!matchesResponse.ok) {
      const errorData = await matchesResponse.json();
      return res.status(matchesResponse.status).json({
        error: errorData.status?.message || "Erro ao buscar histórico de partidas",
        statusCode: matchesResponse.status
      });
    }

    const matchIds = await matchesResponse.json();

    // 4. Processar partidas em paralelo com tratamento de erros individual
    const matchesData = await Promise.allSettled(
      matchIds.map(async (matchId) => {
        try {
          const matchRes = await fetch(
            `https://americas.api.riotgames.com/lol/match/v5/matches/${matchId}`,
            { headers: { "X-Riot-Token": process.env.RIOT_API_KEY } }
          );
          return matchRes.ok ? await matchRes.json() : null;
        } catch (error) {
          console.error(`Erro ao processar partida ${matchId}:`, error.message);
          return null;
        }
      })
    );

    // 5. Calcular estatísticas
    const stats = {
      vitorias: 0,
      total: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalAssists: 0,
      totalCS: 0,
      totalGameDuration: 0,
      kda: 0,
      csPerMinute: 0,
      winRate: 0,
      matches: []
    };

    const validMatches = matchesData
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);

    for (const match of validMatches) {
      const participant = match.info.participants.find(
        p => p.puuid === puuid && p.championId.toString() === championId
      );

      if (participant) {
        stats.total++;
        if (participant.win) stats.vitorias++;
        
        stats.totalKills += participant.kills;
        stats.totalDeaths += participant.deaths;
        stats.totalAssists += participant.assists;
        
        const totalCS = participant.totalMinionsKilled + (participant.neutralMinionsKilled || 0);
        stats.totalCS += totalCS;
        
        const gameDurationMinutes = match.info.gameDuration / 60;
        stats.totalGameDuration += gameDurationMinutes;
        
        stats.matches.push({
          matchId: match.metadata.matchId,
          gameCreation: new Date(match.info.gameCreation).toISOString(),
          gameDuration: match.info.gameDuration,
          gameMode: match.info.gameMode,
          win: participant.win,
          kills: participant.kills,
          deaths: participant.deaths,
          assists: participant.assists,
          championName: participant.championName,
          champLevel: participant.champLevel,
          totalCS,
          csPerMinute: parseFloat((totalCS / gameDurationMinutes).toFixed(1)),
          items: [
            participant.item0,
            participant.item1,
            participant.item2,
            participant.item3,
            participant.item4,
            participant.item5,
            participant.item6
          ],
          summonerSpells: [
            participant.summoner1Id,
            participant.summoner2Id
          ],
          perks: participant.perks,
          lane: participant.lane,
          role: participant.role
        });
      }
    }

    // 6. Calcular métricas agregadas
    if (stats.total > 0) {
      stats.winRate = parseFloat(((stats.vitorias / stats.total) * 100).toFixed(1));
      stats.kda = parseFloat(
        ((stats.totalKills + stats.totalAssists) / Math.max(stats.totalDeaths, 1)).toFixed(2)
      );
      stats.csPerMinute = parseFloat(
        (stats.totalCS / stats.totalGameDuration).toFixed(1)
      );
    }

    // 7. Ordenar partidas pelas mais recentes
    stats.matches.sort((a, b) => new Date(b.gameCreation) - new Date(a.gameCreation));

    // 8. Resposta formatada
    res.status(200).json({
      summoner: { nome, tag, puuid },
      champion: {
        id: championId,
        name: championData.name,
        title: championData.title,
        image: `https://ddragon.leagueoflegends.com/cdn/14.8.1/img/champion/${championData.image.full}`
      },
      stats,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro no servidor:', error);
    res.status(500).json({
      error: "Erro interno ao processar a requisição",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};