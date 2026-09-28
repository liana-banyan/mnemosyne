// Mnemosyne — Role-Class Types
// MV-HELM-CROWN-AMB SAGA 6 BP045 W1
// ─── Role helpers ─────────────────────────────────────────────────────────────
export function hasRole(roles, ...required) {
    return required.some((r) => roles.includes(r));
}
export function canAccessHelm(roles) {
    return hasRole(roles, 'helm-crown', 'founder');
}
export function canAccessAmbassador(roles) {
    return hasRole(roles, 'ambassador', 'founder');
}
export function canAccessProject(roles) {
    return hasRole(roles, 'project-owner', 'founder');
}
export const SWEET_SIXTEEN = [
    { number: 1, slug: 'lets-make-dinner', name: "Let's Make Dinner", crown: 'Maneet Chauhan' },
    { number: 2, slug: 'lets-get-groceries', name: "Let's Get Groceries" },
    { number: 3, slug: 'lets-go-shopping', name: "Let's Go Shopping", crown: 'Mary Beth Laughton' },
    { number: 4, slug: 'household-concierge', name: 'Household Concierge' },
    { number: 5, slug: 'the-family-table', name: 'The Kitchen Table' },
    { number: 6, slug: 'tatiana-health', name: 'Tatiana Schlossberg Health Accords' },
    { number: 7, slug: 'msa', name: 'MSA', crown: 'Cathie Mahon' },
    { number: 8, slug: 'defense-klaus', name: 'Defense Klaus' },
    { number: 9, slug: 'rally-group', name: 'Rally Group', crown: 'Kimberly A. Williams' },
    { number: 10, slug: 'vsl', name: 'VSL', crown: 'Jessica Jackley' },
    { number: 11, slug: 'lets-make-bread', name: "Let's Make Bread" },
    { number: 12, slug: 'harper-guild', name: 'Harper Guild' },
    { number: 13, slug: 'jukebox', name: 'JukeBox' },
    { number: 14, slug: 'didasko', name: 'Didasko' },
    { number: 15, slug: 'power-to-the-people', name: 'Power to the People' },
    { number: 16, slug: 'brass-tacks', name: 'Brass Tacks' },
];
export function getInitiativeBySlug(slug) {
    return SWEET_SIXTEEN.find((i) => i.slug === slug);
}
