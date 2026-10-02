/** Persisted values use metres. Visual estimates are never installation rules. */
export interface EvidenceRef { url: string; retrievedAt: string; page?: number; section?: string; field: string; sha256?: string }
export interface ParameterDefinition {
 id: string; label: string; unit?: 'm' | 'mm';
 type: 'fixed' | 'derived' | 'number' | 'enum' | 'color';
 values: (number | string)[]; min?: number | null; max?: number; step?: number;
 swatches?: Record<string,string>; allowRequestedRal?: boolean; evidence: string[];
}
export interface AssemblyRule { id: string; type: 'post-table'; parameters: {height:number}; data: {name:string;system:string;height:number;clamps?:number;source:EvidenceRef}; evidence:string[] }
export interface VisualDefinition { type:string; status:'schematic'|'reconstructed'; estimated?:string[]; evidence:string[]; infill?:VisualDefinition; [detail:string]:unknown }
export interface ProductSelection { modelId:string; parameters:Record<string,number|string> }
export interface ProductModel {
 id:string; name:string; family:string; kind:'panel'|'gate'|'accessory'; inScope:boolean;
 sourceProductIds:string[]; sources:EvidenceRef[]; images:string[];
 parameters:ParameterDefinition[]; defaults:ProductSelection['parameters']; custom:boolean;
 assemblyRules:AssemblyRule[]; visual:VisualDefinition|null; limitations:string[];
 commercialVariants:{id:string;sku:string;parameters:ProductSelection['parameters'];evidence:string[]}[];
 compatibleWith:string[]; envelopeOnly?:boolean;
}
export interface ProjectState {
 appId:'decorio-fence'; schemaVersion:2; catalogVersion:string; name:string;
 nodes:{id:string;x:number;y:number}[];
 segments:(ProductSelection & {id:string;a:string;b:string})[];
 gates:(ProductSelection & {id:string;segmentId:string;offset:number;handing:'left'|'right'})[];
 options:{dimensions:boolean};
}
export interface ResolvedAssembly {
 parts:({kind:'panel'|'gate'|'gap'|'post';segmentId?:string;visual?:VisualDefinition;[field:string]:unknown})[];
 items:{id:string;code:string;label:string;quantity:number;unit:string;notes:string;source:EvidenceRef}[];
 issues:{code:string;message:string;segmentId?:string}[];
 totalLength:number; complete:boolean;
}
