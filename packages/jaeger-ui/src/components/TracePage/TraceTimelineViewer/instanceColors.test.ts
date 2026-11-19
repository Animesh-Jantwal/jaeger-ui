// Copyright (c) 2026 The Jaeger Authors.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { computeInstanceIndexes, getInstanceColor } from './instanceColors';
import { makeAttributes } from '../../../model/attributes';
import { IAttribute, IOtelSpan, IResource } from '../../../types/otel';
import colorGenerator from '../../../utils/color-generator';
import { makeOtelSpan } from '../../../utils/test/makeOtelSpan';

function makeResource(serviceName: string, attributes: IAttribute[]): IResource {
  return {
    serviceName,
    attributes: makeAttributes([{ key: 'service.name', value: serviceName }, ...attributes]),
  };
}

function makeSpan(spanID: string, resource: IResource): IOtelSpan {
  return makeOtelSpan({ spanID, resource });
}

describe('computeInstanceIndexes', () => {
  it('leaves out services that ran on a single instance', () => {
    const spans = [
      makeSpan('a1', makeResource('api', [{ key: 'host.name', value: 'host-a' }])),
      makeSpan('a2', makeResource('api', [{ key: 'host.name', value: 'host-a' }])),
      makeSpan('d1', makeResource('db', [{ key: 'host.name', value: 'host-d' }])),
    ];

    expect(computeInstanceIndexes(spans)).toEqual(new Map());
  });

  it('numbers the instances of a service in the order they first appear', () => {
    const hostA = makeResource('api', [{ key: 'host.name', value: 'host-a' }]);
    const hostB = makeResource('api', [{ key: 'host.name', value: 'host-b' }]);
    const spans = [
      makeSpan('a1', hostA),
      makeSpan('b1', hostB),
      makeSpan('a2', hostA),
      makeSpan('d1', makeResource('db', [{ key: 'host.name', value: 'host-d' }])),
    ];

    expect(computeInstanceIndexes(spans)).toEqual(
      new Map([
        ['a1', 0],
        ['b1', 1],
        ['a2', 0],
      ])
    );
  });

  it('identifies an instance by service.instance.id when it is set', () => {
    const spans = [
      makeSpan(
        's1',
        makeResource('api', [
          { key: 'service.instance.id', value: 'i-1' },
          { key: 'host.name', value: 'host-a' },
        ])
      ),
      makeSpan(
        's2',
        makeResource('api', [
          { key: 'service.instance.id', value: 'i-1' },
          { key: 'host.name', value: 'host-b' },
        ])
      ),
      makeSpan('s3', makeResource('api', [{ key: 'service.instance.id', value: 'i-2' }])),
    ];

    expect(computeInstanceIndexes(spans)).toEqual(
      new Map([
        ['s1', 0],
        ['s2', 0],
        ['s3', 1],
      ])
    );
  });

  it('does not depend on the order of resource attributes', () => {
    const spans = [
      makeSpan(
        's1',
        makeResource('api', [
          { key: 'host.name', value: 'host-a' },
          { key: 'k8s.pod.name', value: 'pod-1' },
        ])
      ),
      makeSpan(
        's2',
        makeResource('api', [
          { key: 'k8s.pod.name', value: 'pod-1' },
          { key: 'host.name', value: 'host-a' },
        ])
      ),
    ];

    expect(computeInstanceIndexes(spans)).toEqual(new Map());
  });
});

describe('getInstanceColor', () => {
  const { colors } = colorGenerator;

  it('never returns the color of the bar', () => {
    for (let index = 0; index < colors.length * 2; index++) {
      expect(getInstanceColor(index, colors[0])).not.toBe(colors[0]);
    }
  });

  it('gives different instances different colors', () => {
    expect(getInstanceColor(0, colors[0])).toBe(colors[1]);
    expect(getInstanceColor(1, colors[0])).toBe(colors[2]);
  });

  it('wraps around the palette', () => {
    expect(getInstanceColor(colors.length - 1, colors[0])).toBe(colors[1]);
  });

  it('uses the whole palette when the bar has a color outside of it', () => {
    expect(getInstanceColor(0, 'var(--heatmap-3)')).toBe(colors[0]);
  });
});
