import {readFile,writeFile} from 'node:fs/promises';
const c=JSON.parse(await readFile('catalog/catalog.json'));
const coverage=c.families.map(f=>({id:f.id,name:f.name,status:f.status,products:c.products.filter(p=>p.family===f.id).length,variants:c.products.filter(p=>p.family===f.id).reduce((n,p)=>n+p.variants.length,0),limitations:f.limitations,source:f.source}));
await writeFile('catalog/coverage.json',JSON.stringify({version:c.version,reviewedAt:c.reviewedAt,families:coverage},null,2)+'\n');
await writeFile('docs/catalog-coverage.md','# Acoperire catalog Decorio\n\nInventar consultat: '+c.reviewedAt+'. Variantele parțiale permit vizualizarea, nu certifică un sistem complet de montaj.\n\n| Familie | Produse | Variante | Stare | Limite |\n|---|---:|---:|---|---|\n'+coverage.map(f=>`| ${f.name} | ${f.products} | ${f.variants} | ${f.status} | ${f.limitations.join('; ')} |`).join('\n')+'\n');
console.log(coverage.length+' families; '+c.products.length+' products; '+c.products.reduce((n,p)=>n+p.variants.length,0)+' variants');
