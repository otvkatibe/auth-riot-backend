import fetch from 'node-fetch';

const RIOT_API_KEY = process.env.RIOT_API_KEY;

export const fetchRiotAccount = async (gameName, tagLine) => {
  const response = await fetch(
    `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`,
    { headers: { 'X-Riot-Token': RIOT_API_KEY } }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch Riot account');
  }
  
  return response.json();
};

export const fetchSummonerData = async (puuid, region = 'br1') => {
  const response = await fetch(
    `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
    { headers: { 'X-Riot-Token': RIOT_API_KEY } }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch summoner data');
  }
  
  return response.json();
};