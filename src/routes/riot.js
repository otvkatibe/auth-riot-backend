import express from 'express';
import { getData } from '/workspaces/auth-riot-backend/src/controllers/riot/dados.js';
import { getPuuid } from '/workspaces/auth-riot-backend/src/controllers/riot/puuid.js';
import { getProfile } from '/workspaces/auth-riot-backend/src/controllers/riot/perfil.js';
import { getDetails } from '/workspaces/auth-riot-backend/src/controllers/riot/detalhes.js';

const router = express.Router();

router.get('/puuid', getPuuid);
router.get('/perfil', getProfile);
router.get('/dados', getData);
router.get('/detalhes', getDetails);

export default router;