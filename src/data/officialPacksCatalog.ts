export interface OfficialDocument {
  id: string;
  title: string;
  type: 'PE' | 'RAPE' | 'FRP' | 'MANUEL' | 'GUIDE' | 'LIVRET' | 'DIRECTIVE';
  level: string; // Niveaux : T0 à T10, puis T11L/T11S/T11OSE et T12L/T12S/T12OSE
  cycle: 'Primaire' | 'Collège' | 'Lycée' | 'National';
  subject?: string;
  driveId: string;
  description: string;
}

export const OFFICIAL_DOCUMENTS_CATALOG: OfficialDocument[] = [
  // --- DIRECTIVES GÉNÉRALES ---
  {
    id: 'toro-marika-pe',
    title: 'Toromarika mikasika ny fanapariahana ny Fandaharam-pibeazana (PE)',
    type: 'DIRECTIVE',
    level: 'Tous niveaux',
    cycle: 'National',
    driveId: '1tuUMtornkK94947lPCMWfw7kive607tB',
    description: 'Instructions officielles du MEN pour la généralisation du Nouveau Programme, transition pédagogique et application du RAPE.'
  },

  // --- COLLÈGE : PROGRAMMES & RAPE ---
  {
    id: 'pe-t6',
    title: 'Programme d’Études 6ème (PE T6 2026)',
    type: 'PE',
    level: 'T6',
    cycle: 'Collège',
    driveId: '1zMtH76dLYeul4r_UdqKlbfJ9zuM30WVH',
    description: 'Curriculum officiel complet de la classe de 6ème.'
  },
  {
    id: 'rape-t6',
    title: 'Répartition Annuelle du Programme d’Études (RAPE T6)',
    type: 'RAPE',
    level: 'T6',
    cycle: 'Collège',
    driveId: '1cqeS5twgN3ppV_ASRT6y7gzyxjgLQwKA',
    description: 'Découpage séquentiel annuel officiel pour les enseignants de 6ème.'
  },
  {
    id: 'pe-t7',
    title: 'Programme d’Études 5ème (PE T7 2026)',
    type: 'PE',
    level: 'T7',
    cycle: 'Collège',
    driveId: '1dXVD_EnkQc-9fUDEMkklBLFJ8a5fbmOM',
    description: 'Curriculum officiel complet de la classe de 5ème.'
  },
  {
    id: 'rape-t7',
    title: 'Répartition Annuelle du Programme d’Études (RAPE T7)',
    type: 'RAPE',
    level: 'T7',
    cycle: 'Collège',
    driveId: '1puhNbNrbSl1OZWYcSiVG139GhFEaB7T-',
    description: 'Découpage séquentiel annuel officiel pour la classe de 5ème.'
  },
  {
    id: 'pe-t8',
    title: 'Programme d’Études 4ème (PE T8 2026)',
    type: 'PE',
    level: 'T8',
    cycle: 'Collège',
    driveId: '1Spc_NXvBcDkZyrhzSyv2lEw_3U_NAX3y',
    description: 'Curriculum officiel complet de la classe de 4ème.'
  },
  {
    id: 'rape-t8',
    title: 'Répartition Annuelle du Programme d’Études (RAPE T8)',
    type: 'RAPE',
    level: 'T8',
    cycle: 'Collège',
    driveId: '1Enx4-U99B-SnwJy1A7uneEV9Bj8dz6zQ',
    description: 'Découpage séquentiel annuel officiel pour la classe de 4ème.'
  },
  {
    id: 'pe-t9',
    title: 'Programme d’Études 3ème (PE T9 2026 - Préparation BEPC)',
    type: 'PE',
    level: 'T9',
    cycle: 'Collège',
    driveId: '15zRbU1MJaZfP5i5WSZB1YV5q1qAZGGJH',
    description: 'Curriculum officiel terminal de Collège (examen du BEPC).'
  },
  {
    id: 'rape-t9',
    title: 'Répartition Annuelle du Programme d’Études (RAPE T9)',
    type: 'RAPE',
    level: 'T9',
    cycle: 'Collège',
    driveId: '11UWHqhPxBaO0hnbee8LIF_FXR4GDubyM',
    description: 'Découpage séquentiel officiel pour la classe de 3ème.'
  },

  // --- FICHES DE RESSOURCES PÉDAGOGIQUES (FRP) COLLÈGE ---
  {
    id: 'frp-maths-t9',
    title: 'Fiche Ressources Pédagogiques Maths 3ème (FRP T9)',
    type: 'FRP',
    level: 'T9',
    cycle: 'Collège',
    subject: 'Mathématiques',
    driveId: '1frtett4fm_MP9mrQQW8MEZX5IZYzgLsm',
    description: 'Fiches didactiques détaillées, situations-problèmes et corrigés de référence en Mathématiques 3ème.'
  },
  {
    id: 'frp-sp-t9',
    title: 'Fiche Ressources Pédagogiques Sciences Physiques 3ème (FRP T9)',
    type: 'FRP',
    level: 'T9',
    cycle: 'Collège',
    subject: 'Sciences Physiques',
    driveId: '1qiXzK4ewboMIEQ_8EMQGozQQD6g9qF_s',
    description: 'Didactique officielle de Sciences Physiques pour la classe de 3ème.'
  },
  {
    id: 'frp-svt-t9',
    title: 'Fiche Ressources Pédagogiques SVT 3ème (FRP T9)',
    type: 'FRP',
    level: 'T9',
    cycle: 'Collège',
    subject: 'SVT',
    driveId: '1k7veRbRO_9FyjeKlAYjpeYNwjDT0vQyZ',
    description: 'Ressources et activités didactiques en SVT 3ème.'
  },
  {
    id: 'frp-frs-t9',
    title: 'Fiche Ressources Pédagogiques Français 3ème (FRP T9)',
    type: 'FRP',
    level: 'T9',
    cycle: 'Collège',
    subject: 'Français',
    driveId: '1c4S6ZqRJtfLpnpkDX26h03G-9ZQPm7Tm',
    description: 'Didactique du Français et analyse de textes pour la classe de 3ème.'
  },
  {
    id: 'frp-mlg-t9',
    title: 'Fiche Ressources Pédagogiques Malagasy 3ème (FRP T9)',
    type: 'FRP',
    level: 'T9',
    cycle: 'Collège',
    subject: 'Malagasy',
    driveId: '1NO8bDnrMF5fMhETyRos_-VxODMMPrKgM',
    description: 'Fampianarana ny teny sy literatiora Malagasy amin’ny kilasy faha-3.'
  },
  {
    id: 'frp-maths-t8',
    title: 'Fiche Ressources Pédagogiques Maths 4ème (FRP T8)',
    type: 'FRP',
    level: 'T8',
    cycle: 'Collège',
    subject: 'Mathématiques',
    driveId: '1QPVISuNJlqDAJu9bjFxr3Hr8BSPrvzCy',
    description: 'Fiches didactiques de leçons en Mathématiques 4ème.'
  },
  {
    id: 'frp-sp-t8',
    title: 'Fiche Ressources Pédagogiques Sciences Physiques 4ème (FRP T8)',
    type: 'FRP',
    level: 'T8',
    cycle: 'Collège',
    subject: 'Sciences Physiques',
    driveId: '1XRq1gNKUs1lIABTK1a-DzO_H5qOC5I7X',
    description: 'Ressources de leçons et d’expériences en Physique-Chimie 4ème.'
  },
  {
    id: 'frp-maths-t7',
    title: 'Fiche Ressources Pédagogiques Maths 5ème (FRP T7)',
    type: 'FRP',
    level: 'T7',
    cycle: 'Collège',
    subject: 'Mathématiques',
    driveId: '1EpVfzh3m-qWugRC0vOSTwlFQubQz2-Tv',
    description: 'Fiches didactiques de leçons en Mathématiques 5ème.'
  },
  {
    id: 'frp-maths-t6',
    title: 'Fiche Ressources Pédagogiques Maths 6ème (FRP T6)',
    type: 'FRP',
    level: 'T6',
    cycle: 'Collège',
    subject: 'Mathématiques',
    driveId: '1DZ8w7I_TiBfWT_B-Y8kKxXK7N_kevD0B',
    description: 'Fiches didactiques de leçons en Mathématiques 6ème.'
  },

  // --- LYCÉE : PROGRAMMES & RAPE ---
  {
    id: 'pe-t10',
    title: 'Programme d’Études Lycée 2nde (PE T10)',
    type: 'PE',
    level: 'T10',
    cycle: 'Lycée',
    driveId: '1hcu4EPvU88pPUw__siZTVb3QP2L5RLX6',
    description: 'Curriculum officiel de tronc commun pour la classe de Seconde.'
  },
  {
    id: 'rape-t10',
    title: 'Répartition Annuelle Lycée 2nde (RAPE T10)',
    type: 'RAPE',
    level: 'T10',
    cycle: 'Lycée',
    driveId: '1nuSSuD8ZpXSYiFymf6CQPNHWak_NABxh',
    description: 'Découpage séquentiel annuel de la classe de Seconde.'
  },
  {
    id: 'pe-t11',
    title: 'Programme d’Études Lycée 1ère (PE T11 L, S, OSE)',
    type: 'PE',
    level: 'T11',
    cycle: 'Lycée',
    driveId: '12zJj-BWJEVYf8NvTHKtcIDCe-aACXEQL',
    description: 'Curriculum officiel des filières Littéraire (L), Scientifique (S) et OSE.'
  },
  {
    id: 'rape-t11-s',
    title: 'Répartition Annuelle 1ère Scientifique (RAPE T11 S)',
    type: 'RAPE',
    level: 'T11',
    cycle: 'Lycée',
    subject: 'Série Scientifique (S)',
    driveId: '1uyB3J9nGIp2srOmseejlBFoeGDyJyEzQ',
    description: 'Découpage séquentiel officiel pour la 1ère S.'
  },
  {
    id: 'rape-t11-l',
    title: 'Répartition Annuelle 1ère Littéraire (RAPE T11 L)',
    type: 'RAPE',
    level: 'T11',
    cycle: 'Lycée',
    subject: 'Série Littéraire (L)',
    driveId: '1sD1UV56kWkDxYqHXRGv_rnLXTDl2NWKG',
    description: 'Découpage séquentiel officiel pour la 1ère L.'
  },
  {
    id: 'pe-t12',
    title: 'Programme d’Études Terminale (PE T12 - Préparation Baccalauréat)',
    type: 'PE',
    level: 'T12',
    cycle: 'Lycée',
    driveId: '1glKXDDxgOyfO5fIqFeZV6PDOxVBFe0IN',
    description: 'Curriculum officiel complet de Terminale pour le Baccalauréat à Madagascar.'
  },
  {
    id: 'rape-t12-s',
    title: 'Répartition Annuelle Terminale Scientifique (RAPE T12 S)',
    type: 'RAPE',
    level: 'T12',
    cycle: 'Lycée',
    subject: 'Série Scientifique (S / C / D)',
    driveId: '1briBUGmmwOjzOWzU7B6Bp5f6tRF2fpDz',
    description: 'Découpage séquentiel officiel de Terminale S.'
  },

  // --- PRIMAIRE : PROGRAMMES & RAPE (T1 à T5) ---
  {
    id: 'pe-t1',
    title: 'Programme d’Études T1 (CP1 / 11ème)',
    type: 'PE',
    level: 'T1',
    cycle: 'Primaire',
    driveId: '1Qhce8za40TGvkHlWjCJwQRKNgcou64Vw',
    description: 'Curriculum fondamental du premier niveau du primaire.'
  },
  {
    id: 'pe-t2',
    title: 'Programme d’Études T2 (CP2 / 10ème)',
    type: 'PE',
    level: 'T2',
    cycle: 'Primaire',
    driveId: '1wV9_UmlYKwA9w4sgXPPCx5XBr6lfXU5T',
    description: 'Curriculum de deuxième année primaire.'
  },
  {
    id: 'pe-t3',
    title: 'Programme d’Études T3 (CE / 9ème)',
    type: 'PE',
    level: 'T3',
    cycle: 'Primaire',
    driveId: '1vRGQG4hdmERLT5rZC-SLaOPr_SaQJ-j-',
    description: 'Curriculum de Cours Élémentaire.'
  },
  {
    id: 'pe-t4',
    title: 'Programme d’Études T4 (CM1 / 8ème)',
    type: 'PE',
    level: 'T4',
    cycle: 'Primaire',
    driveId: '1uU5wLKDOxhNvC8MVEIo4MTuT3s8NFKOE',
    description: 'Curriculum de Cours Moyen 1.'
  },
  {
    id: 'pe-t5',
    title: 'Programme d’Études T5 (CM2 / 7ème - Préparation CEPE)',
    type: 'PE',
    level: 'T5',
    cycle: 'Primaire',
    driveId: '1DgXoqwU2Ah0QlsiI60oi-SzormeIADdw',
    description: 'Curriculum officiel terminal du primaire préparant au CEPE et au concours d’entrée en 6ème.'
  },
  {
    id: 'rape-t5',
    title: 'Répartition Annuelle Primaire T5 (RAPE T5 CEPE)',
    type: 'RAPE',
    level: 'T5',
    cycle: 'Primaire',
    driveId: '1dFQU1UqC3X9pxU4XzQ2CjpjdSTWVcRiz',
    description: 'Découpage séquentiel annuel pour la préparation de la classe de CEPE.'
  }
];

export const GENERAL_FOLDER_LINK = "https://drive.google.com/drive/folders/1cTyk_C1iZJfye2E8tv6QhAvsCr8Ykbv8?usp=drive_link";

