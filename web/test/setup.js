import { i18n } from '@lingui/core';

// Code under test calls Lingui's `t`; an empty English catalog returns the source strings.
i18n.loadAndActivate({ locale: 'en', messages: {} });
