import { DEFAULT_MAP_STYLE, DEFAULT_MAP_VIEWPORT } from '@outbound/core';
import MapboxGL from '@rnmapbox/maps';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TVI_BORDER, tviFillColorExpressionNative } from '@/lib/tviColors';
import {
  geometryCentroid,
  type GeographyFeatureProperties,
} from '@/services/geographies';

import type { MapProps } from './Map.types';

const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const SOURCE_ID = 'tvi-geographies';
const FILL_LAYER_ID = 'tvi-choropleth-fill';
const LINE_LAYER_ID = 'tvi-choropleth-line';

if (token) {
  void MapboxGL.setAccessToken(token);
}

export default function Map({
  style,
  geojson = null,
  matchedIsoCodes = null,
  selectedIsoCode = null,
  flyToTarget = null,
  onGeographyClick,
}: MapProps) {
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const fillColor = useMemo(() => tviFillColorExpressionNative(), []);

  const fillOpacity = useMemo(() => {
    const matchedList = matchedIsoCodes ? Array.from(matchedIsoCodes) : null;
    if (matchedList == null) return 0.7;
    return [
      'case',
      ['in', ['get', 'isoCode'], ['literal', matchedList]],
      0.7,
      0.15,
    ] as unknown[];
  }, [matchedIsoCodes]);

  const lineWidth = useMemo(
    () =>
      [
        'case',
        ['==', ['get', 'isoCode'], selectedIsoCode ?? ''],
        1.5,
        0.5,
      ] as unknown[],
    [selectedIsoCode]
  );

  useEffect(() => {
    if (!flyToTarget) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [flyToTarget.longitude, flyToTarget.latitude],
      zoomLevel: flyToTarget.zoom ?? 4,
      animationDuration: 900,
    });
  }, [flyToTarget]);

  if (!token) {
    return (
      <View style={StyleSheet.flatten([styles.fallback, style])}>
        <Text style={styles.fallbackTitle}>Map unavailable</Text>
        <Text style={styles.fallbackCopy}>
          Set EXPO_PUBLIC_MAPBOX_TOKEN in apps/universal/.env to render the Mapbox base map.
        </Text>
      </View>
    );
  }

  return (
    <View style={StyleSheet.flatten([styles.container, style])}>
      <MapboxGL.MapView style={styles.map} styleURL={DEFAULT_MAP_STYLE}>
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [
              DEFAULT_MAP_VIEWPORT.longitude,
              DEFAULT_MAP_VIEWPORT.latitude,
            ],
            zoomLevel: DEFAULT_MAP_VIEWPORT.zoom,
          }}
        />
        {geojson ? (
          <MapboxGL.ShapeSource
            id={SOURCE_ID}
            shape={geojson}
            onPress={(event) => {
              const feature = event.features?.[0];
              if (!feature?.properties) return;
              const props = feature.properties as GeographyFeatureProperties;
              const normalized: GeographyFeatureProperties = {
                ...props,
                overall:
                  props.overall == null &&
                  (props as { overallScore?: number | null }).overallScore == null
                    ? null
                    : Number(
                        props.overall ??
                          (props as { overallScore?: number | null }).overallScore
                      ),
                population:
                  props.population == null ? null : Number(props.population),
                tourismInfrastructure:
                  props.tourismInfrastructure == null
                    ? null
                    : Number(props.tourismInfrastructure),
                accessibility:
                  props.accessibility == null
                    ? null
                    : Number(props.accessibility),
                costIndex:
                  props.costIndex == null
                    ? null
                    : Number(props.costIndex),
                safetyAndEntry:
                  props.safetyAndEntry == null
                    ? null
                    : Number(props.safetyAndEntry),
                travelInfrastructure:
                  props.travelInfrastructure == null
                    ? null
                    : Number(props.travelInfrastructure),
                crowding:
                  props.crowding == null
                    ? null
                    : Number(props.crowding),
                trajectory:
                  props.trajectory == null ? null : Number(props.trajectory),
              };
              const centroid =
                geometryCentroid(feature.geometry) ??
                ([
                  DEFAULT_MAP_VIEWPORT.longitude,
                  DEFAULT_MAP_VIEWPORT.latitude,
                ] as [number, number]);
              // eslint-disable-next-line no-console
              console.log(
                '[Map.native] tapped',
                normalized.name,
                'TVI',
                normalized.overall
              );
              onGeographyClick?.(normalized, centroid);
            }}
          >
            <MapboxGL.FillLayer
              id={FILL_LAYER_ID}
              style={{
                fillColor: fillColor as never,
                fillOpacity: fillOpacity as never,
              }}
            />
            <MapboxGL.LineLayer
              id={LINE_LAYER_ID}
              style={{
                lineColor: TVI_BORDER,
                lineWidth: lineWidth as never,
              }}
            />
          </MapboxGL.ShapeSource>
        ) : null}
      </MapboxGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: 320,
  },
  map: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#1a1a1a',
    gap: 8,
  },
  fallbackTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  fallbackCopy: {
    color: '#cccccc',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 360,
  },
});
