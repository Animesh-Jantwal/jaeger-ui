// Copyright (c) 2026 The Jaeger Authors.
// SPDX-License-Identifier: Apache-2.0

import colorGenerator from '../../../utils/color-generator';
import { IOtelSpan, IResource } from '../../../types/otel';

const SERVICE_INSTANCE_ID = 'service.instance.id';

function instanceKeyOf(resource: IResource): string {
  const instanceID = resource.attributes.getValue(SERVICE_INSTANCE_ID);
  if (instanceID !== undefined) {
    return JSON.stringify([SERVICE_INSTANCE_ID, instanceID]);
  }
  return resource.attributes
    .entries()
    .map(({ key, value }) => JSON.stringify([key, value]))
    .sort()
    .join(',');
}

export function computeInstanceIndexes(spans: ReadonlyArray<IOtelSpan>): Map<string, number> {
  const instanceKeys = new Map<IResource, string>();
  const instancesByService = new Map<string, Map<string, number>>();
  const assigned: Array<{ spanID: string; instances: Map<string, number>; index: number }> = [];

  for (const span of spans) {
    const { resource } = span;
    let key = instanceKeys.get(resource);
    if (key === undefined) {
      key = instanceKeyOf(resource);
      instanceKeys.set(resource, key);
    }
    let instances = instancesByService.get(resource.serviceName);
    if (!instances) {
      instances = new Map();
      instancesByService.set(resource.serviceName, instances);
    }
    let index = instances.get(key);
    if (index === undefined) {
      index = instances.size;
      instances.set(key, index);
    }
    assigned.push({ spanID: span.spanID, instances, index });
  }

  const indexes = new Map<string, number>();
  for (const { spanID, instances, index } of assigned) {
    if (instances.size > 1) {
      indexes.set(spanID, index);
    }
  }
  return indexes;
}

export function getInstanceColor(instanceIndex: number, barColor: string): string {
  const palette = colorGenerator.colors.filter(color => color !== barColor);
  return palette[instanceIndex % palette.length];
}
