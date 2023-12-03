import React from 'react';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import ErrorPage from '../content/Error';

describe('LoginPage component', () => {
  it('renders the LoginPage component with mock data', async () => {
    render(
      <MockedProvider addTypename={false}>
        <ErrorPage />
      </MockedProvider>
    );

    const errorText = screen.getByText('Add error page here (status 404). Check in content/Error/index.tsx file');
    expect(errorText).toBeInTheDocument();
  });
});