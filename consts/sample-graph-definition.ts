export const SAMPLE_GRAPH_DEFINITION = `
graph LR
    A(Dorothy Gale) -->|Pet| B([Toto])
    A -->|Family| C([Uncle Henry and Aunt Em])
    A -->|Friends| D([Scarecrow])
    A -->|Friends| E([Tin Woodman])
    A -->|Friends| F([Cowardly Lion])
    A -->|Enemy| G([The Wicked Witch of The West])
    A -->|Enemy| H([The Wizard of OZ])
    A -->|Helps Dorothy| I([Glinda])
    D -->|Friends| E
    E -->|Friends| F
    B -->|In Kansas| C`
