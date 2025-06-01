export const SAMPLE_GRAPH_DEFINITION = `
graph LR
    A(Elinor Dashwood) -->|Sister| B([Marianne Dashwood])
    A -->|Mother| C([Mrs. Dashwood])
    A -->|Love Interest| D([Edward Ferrars])
    B -->|Love Interest| E([John Willoughby])
    B -->|Admirer| F([Colonel Brandon])
    C -->|Stepbrother| G([John Dashwood])
    G -->|Wife| H([Fanny Dashwood])
    D -->|Fiancée| I([Lucy Steele])
    F -->|Guardian| J([Eliza Williams])`
