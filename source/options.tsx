import 'webext-base-css/webext-base.css';
import './options.css';
import React from 'dom-chef';
import cache from 'webext-storage-cache';
import domify from 'doma';
import select from 'select-dom';
import delegate from 'delegate-it';
import fitTextarea from 'fit-textarea';
import * as indentTextarea from 'indent-textarea';

import {perDomainOptions} from './options-storage';

// Don't repeat the magic variable, or its content will be inlined multiple times
const features = __featuresMeta__;

function moveNewAndDisabledFeaturesToTop(): void {
	const container = select('.js-features')!;

	for (const unchecked of select.all('.feature [type=checkbox]:not(:checked)', container).reverse()) {
		// .reverse() needed to preserve alphabetical order while prepending
		container.prepend(unchecked.closest('.feature')!);
	}

	for (const newFeature of select.all('.feature-new', container).reverse()) {
		// .reverse() needed to preserve alphabetical order while prepending
		container.prepend(newFeature);
	}
}

function buildFeatureCheckbox({id, description, screenshot}: FeatureMeta): HTMLElement {
	const descriptionElement = domify.one(description)!;
	descriptionElement.className = 'description';

	return (
		<div className="feature" data-text={`${id} ${description}`.toLowerCase()}>
			<input type="checkbox" name={`feature:${id}`} id={id}/>
			<div className="info">
				<label htmlFor={id}>
					<span className="feature-name">{id}</span>
					{' '}
					<a href={`https://github.com/zlwaterfield/refined-zapier/blob/main/source/features/${id}.tsx`}>
						source
					</a>
					{screenshot && <>, <a href={screenshot}>screenshot</a></>}
					{descriptionElement}
				</label>
			</div>
		</div>
	);
}

async function clearCacheHandler(event: Event): Promise<void> {
	await cache.clear();
	const button = event.target as HTMLButtonElement;
	const initialText = button.textContent;
	button.textContent = 'Cache cleared!';
	button.disabled = true;
	setTimeout(() => {
		button.textContent = initialText;
		button.disabled = false;
	}, 2000);
}

function featuresFilterHandler(event: Event): void {
	const keywords = (event.currentTarget as HTMLInputElement).value.toLowerCase()
		.replace(/\W/g, ' ')
		.split(/\s+/)
		.filter(Boolean); // Ignore empty strings
	for (const feature of select.all('.feature')) {
		feature.hidden = !keywords.every(word => feature.dataset.text!.includes(word));
	}
}

async function highlightNewFeatures(): Promise<void> {
	const {featuresAlreadySeen} = await browser.storage.local.get({featuresAlreadySeen: {}});
	const isFirstVisit = Object.keys(featuresAlreadySeen).length === 0;
	const tenDaysAgo = Date.now() - (10 * 24 * 60 * 60 * 1000);

	for (const feature of select.all('.feature [type=checkbox]')) {
		if (!(feature.id in featuresAlreadySeen)) {
			featuresAlreadySeen[feature.id] = isFirstVisit ? tenDaysAgo : Date.now();
		}

		if (featuresAlreadySeen[feature.id] > tenDaysAgo) {
			feature.parentElement!.classList.add('feature-new');
		}
	}

	void browser.storage.local.set({featuresAlreadySeen});
}

async function generateDom(): Promise<void> {
	// Generate list
	select('.js-features')!.append(...features.map(buildFeatureCheckbox));

	// Update list from saved options
	await perDomainOptions.syncForm('form');

	// Decorate list
	await highlightNewFeatures();
	moveNewAndDisabledFeaturesToTop();

	// Move debugging tools higher when side-loaded
	if (process.env.NODE_ENV === 'development') {
		select('#debugging-position')!.replaceWith(select('#debugging')!);
	}

	// Add feature count. CSS-only features are added approximately
	select('.features-header')!.append(` (${features.length + 25})`);
}

function addEventListeners(): void {
	// Refresh page when permissions are changed (because the dropdown selector needs to be regenerated)
	browser.permissions.onRemoved.addListener(() => {
		location.reload();
	});
	browser.permissions.onAdded.addListener(() => {
		location.reload();
	});

	// Improve textareas editing
	fitTextarea.watch('textarea');
	indentTextarea.watch('textarea');

	// Filter feature list
	select('#filter-features')!.addEventListener('input', featuresFilterHandler);

	// Add cache clearer
	select('#clear-cache')!.addEventListener('click', clearCacheHandler);

	// Ensure all links open in a new tab #3181
	delegate(document, 'a[href^="http"]', 'click', event => {
		event.preventDefault();
		window.open(event.delegateTarget.href);
	});
}

async function init(): Promise<void> {
	await generateDom();
	addEventListeners();
}

void init();
