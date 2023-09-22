import { DirectusField, DirectusRelation } from "./schema";

export type RelationshipReference = {
  collection: string;
  pk: string;
};

export type OneToMany = {
  type: "o2m";
  collection: string;
  field: string;
  many: true;
  ref: RelationshipReference;
};

export type ManyToOne = {
  type: "m2o";
  collection: string;
  field: string;
  many: false;
  ref: RelationshipReference;
};

export type AnyToOne = {
  type: "a2o";
  collection: string;
  field: string;
  refs: RelationshipReference[];
};

export type Relationship = OneToMany | ManyToOne | AnyToOne | null;

export function isRelationship(
  relationship?: Relationship,
): relationship is Exclude<Relationship, null> {
  return !!relationship;
}

export function isOneToMany(
  relationship?: Relationship,
): relationship is OneToMany {
  return relationship?.type === "o2m";
}

export function isManyToOne(
  relationship?: Relationship,
): relationship is ManyToOne {
  return relationship?.type === "m2o";
}

export function isAnyToOne(
  relationship?: Relationship,
): relationship is AnyToOne {
  return relationship?.type === "a2o";
}

export function getRelationship(
  fields: DirectusField[],
  relations: DirectusRelation[],
  context: {
    collection: string;
    field: string;
  },
): Relationship {
  const { collection, field } = context;
  const relationship = relations.find(
    (relation) =>
      (relation.collection == collection && relation.field === field) ||
      (relation.related_collection === collection &&
        relation.meta?.one_field === field),
  );

  if (!relationship) {
    return null;
  }

  const parseCollections = (
    collections: string | string[],
  ): RelationshipReference[] => {
    if (!Array.isArray(collections)) {
      collections = collections.split(",");
    }

    return collections
      .map((collection) => collection.trim())
      .map((collection) => ({
        collection: collection,
        pk: findPrimaryKey(collection),
      }));
  };

  const findPrimaryKey = (collection: string) => {
    const field = fields.find(
      (candidate) =>
        candidate.collection == collection && candidate.schema?.is_primary_key,
    );
    if (!field) {
      throw new Error(`Cannot find primary key for ${collection}`);
    }
    return field.field;
  };

  if (
    relationship.collection === collection &&
    relationship.field === field &&
    relationship.meta?.one_collection_field &&
    relationship.meta?.one_allowed_collections
  ) {
    return {
      type: "a2o",
      collection,
      field,
      refs: parseCollections(relationship.meta.one_allowed_collections),
    };
  }

  if (relationship.collection === collection && relationship.field === field) {
    return {
      type: "m2o",
      many: false,
      collection,
      field,
      ref: {
        collection: relationship.meta.one_collection!,
        pk: findPrimaryKey(relationship.meta.one_collection!),
      },
    };
  }

  if (
    relationship.related_collection === collection &&
    relationship.meta.one_field === field
  ) {
    return {
      type: "o2m",
      many: true,
      collection,
      field,
      ref: {
        collection: relationship.meta.many_collection!,
        pk: findPrimaryKey(relationship.meta.many_collection!),
      },
    };
  }

  return null;
}
