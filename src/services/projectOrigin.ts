/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { AppsScriptProject } from '../types';

/**
 * Where a project came from. Cloud projects are bound to a real Apps Script
 * project id and can be pushed to Google; local projects exist only in the
 * browser (imported from files, demo data) and must be bound first.
 */
export type ProjectOrigin = NonNullable<AppsScriptProject['origin']>;

/** Real Apps Script ids are long alphanumeric strings. */
export const isGoogleScriptId = (value: string): boolean => /^[a-zA-Z0-9_-]{20,}$/.test(value);

/** Ids minted locally for file-imported projects. */
export const isLocalScriptId = (value: string): boolean => /^1LOCAL_[a-zA-Z0-9_-]{4,}$/.test(value);

export const generateLocalScriptId = (): string =>
  `1LOCAL_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

/** Demo projects ship fake ids and must never hit the Google APIs. */
export const isDemoScriptId = (value: string): boolean => value.startsWith('1DEMO_');

export const isLocalProject = (project: Pick<AppsScriptProject, 'scriptId' | 'origin'>): boolean =>
  project.origin === 'local' ||
  isLocalScriptId(project.scriptId) ||
  isDemoScriptId(project.scriptId);

/** True when the project can be pushed to / executed on Google Apps Script. */
export const isCloudBoundProject = (
  project: Pick<AppsScriptProject, 'scriptId' | 'origin'>
): boolean => !isLocalProject(project);
